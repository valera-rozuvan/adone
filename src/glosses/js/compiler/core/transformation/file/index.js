const {
    js: {
        compiler: { types, parse, helpers, codeFrame, traverse, generate }
    },
    sourcemap,
    vendor: { lodash: { defaults } },
    std: { path },
    is
} = adone;
const { NodePath, Hub } = traverse;

import * as metadataVisitor from "./metadata";
import OptionManager from "./options/option_manager";
import PluginPass from "../plugin_pass";
import Logger from "./logger";
import Store from "../../store";
import * as util from "../../util";
import resolve from "../../helpers/resolve";
import blockHoistPlugin from "../internal_plugins/block_hoist";
import shadowFunctionsPlugin from "../internal_plugins/shadow_functions";

const shebangRegex = /^#!.*/;

const INTERNAL_PLUGINS = [
    [blockHoistPlugin],
    [shadowFunctionsPlugin]
];

const errorVisitor = {
    enter(path, state) {
        const loc = path.node.loc;
        if (loc) {
            state.loc = loc;
            path.stop();
        }
    }
};

const commentRx = /^\s*\/(?:\/|\*)[@#]\s+sourceMappingURL=data:(?:application|text)\/json;(?:charset[:=]\S+;)?base64,(.*)$/mg;
const removeSourceMapComments = (src) => {
    commentRx.lastIndex = 0;
    return src.replace(commentRx, "");
};

const sourceMapFromSource = (content) => {
    let m = content.match(commentRx);
    commentRx.lastIndex = 0;
    if (!m) {
        return null;
    }
    m = m.pop();
    m = m.replace(/^\/\*/g, "//").replace(/\*\/$/g, "");
    m = m.split(",").pop();  // strip comment
    m = Buffer.from(m, "base64").toString();
    return JSON.parse(m);
};

const sourceMapToComment = (sourceMap) => {
    sourceMap = JSON.stringify(sourceMap);
    sourceMap = Buffer.from(sourceMap).toString("base64");
    return `//# sourceMappingURL=data:application/json;base64,${sourceMap}`;
};

export default class File extends Store {
    constructor(opts = {}, pipeline) {
        super();

        this.pipeline = pipeline;

        this.log = new Logger(this, opts.filename || "unknown");
        this.opts = this.initOptions(opts);

        this.parserOpts = {
            sourceType: this.opts.sourceType,
            sourceFileName: this.opts.filename,
            plugins: []
        };

        this.pluginVisitors = [];
        this.pluginPasses = [];

        // Plugins for top-level options.
        this.buildPluginsForOptions(this.opts);

        // If we are in the "pass per preset" mode, build
        // also plugins for each preset.
        if (this.opts.passPerPreset) {
            // All the "per preset" options are inherited from the main options.
            this.perPresetOpts = [];
            this.opts.presets.forEach((presetOpts) => {
                const perPresetOpts = Object.assign(Object.create(this.opts), presetOpts);
                this.perPresetOpts.push(perPresetOpts);
                this.buildPluginsForOptions(perPresetOpts);
            });
        }

        this.metadata = {
            usedHelpers: [],
            marked: [],
            modules: {
                imports: [],
                exports: {
                    exported: [],
                    specifiers: []
                }
            }
        };

        this.dynamicImportTypes = {};
        this.dynamicImportIds = {};
        this.dynamicImports = [];
        this.declarations = {};
        this.usedHelpers = {};

        this.path = null;
        this.ast = {};

        this.code = "";
        this.shebang = "";

        this.hub = new Hub(this);
    }

    getMetadata() {
        let has = false;
        for (const node of this.ast.program.body) {
            if (types.isModuleDeclaration(node)) {
                has = true;
                break;
            }
        }
        if (has) {
            this.path.traverse(metadataVisitor, this);
        }
    }

    initOptions(opts) {
        opts = new OptionManager(this.log, this.pipeline).init(opts);

        if (opts.inputSourceMap) {
            opts.sourceMaps = true;
        }

        if (opts.moduleId) {
            opts.moduleIds = true;
        }

        opts.basename = path.basename(opts.filename, path.extname(opts.filename));

        opts.ignore = util.arrayify(opts.ignore, util.regexify);

        if (opts.only) {
            opts.only = util.arrayify(opts.only, util.regexify);
        }

        defaults(opts, {
            moduleRoot: opts.sourceRoot
        });

        defaults(opts, {
            sourceRoot: opts.moduleRoot
        });

        defaults(opts, {
            filenameRelative: opts.filename
        });

        const basenameRelative = path.basename(opts.filenameRelative);

        defaults(opts, {
            sourceFileName: basenameRelative,
            sourceMapTarget: basenameRelative
        });

        return opts;
    }

    buildPluginsForOptions(opts) {
        if (!is.array(opts.plugins)) {
            return;
        }

        const plugins = opts.plugins.concat(INTERNAL_PLUGINS);
        const currentPluginVisitors = [];
        const currentPluginPasses = [];

        // init plugins!
        for (const ref of plugins) {
            const [plugin, pluginOpts] = ref; // todo: fix - can't embed in loop head because of flow bug

            currentPluginVisitors.push(plugin.visitor);
            currentPluginPasses.push(new PluginPass(this, plugin, pluginOpts));

            if (plugin.manipulateOptions) {
                plugin.manipulateOptions(opts, this.parserOpts, this);
            }
        }

        this.pluginVisitors.push(currentPluginVisitors);
        this.pluginPasses.push(currentPluginPasses);
    }

    getModuleName() {
        const opts = this.opts;
        if (!opts.moduleIds) {
            return null;
        }

        // moduleId is n/a if a `getModuleId()` is provided
        if (is.exist(opts.moduleId) && !opts.getModuleId) {
            return opts.moduleId;
        }

        let filenameRelative = opts.filenameRelative;
        let moduleName = "";

        if (is.exist(opts.moduleRoot)) {
            moduleName = `${opts.moduleRoot}/`;
        }

        if (!opts.filenameRelative) {
            return moduleName + opts.filename.replace(/^\//, "");
        }

        if (is.exist(opts.sourceRoot)) {
            // remove sourceRoot from filename
            const sourceRootRegEx = new RegExp(`^${opts.sourceRoot}\/?`);
            filenameRelative = filenameRelative.replace(sourceRootRegEx, "");
        }

        // remove extension
        filenameRelative = filenameRelative.replace(/\.(\w*?)$/, "");

        moduleName += filenameRelative;

        // normalize path separators
        moduleName = moduleName.replace(/\\/g, "/");

        if (opts.getModuleId) {
            // If return is falsy, assume they want us to use our generated default name
            return opts.getModuleId(moduleName) || moduleName;
        }
        return moduleName;

    }

    resolveModuleSource(source) {
        const resolveModuleSource = this.opts.resolveModuleSource;
        if (resolveModuleSource) {
            source = resolveModuleSource(source, this.opts.filename);
        }
        return source;
    }

    addImport(source, imported, name = imported) {
        const alias = `${source}:${imported}`;
        let id = this.dynamicImportIds[alias];

        if (!id) {
            source = this.resolveModuleSource(source);
            id = this.dynamicImportIds[alias] = this.scope.generateUidIdentifier(name);

            const specifiers = [];

            if (imported === "*") {
                specifiers.push(types.importNamespaceSpecifier(id));
            } else if (imported === "default") {
                specifiers.push(types.importDefaultSpecifier(id));
            } else {
                specifiers.push(types.importSpecifier(id, types.identifier(imported)));
            }

            const declar = types.importDeclaration(specifiers, types.stringLiteral(source));
            declar._blockHoist = 3;

            this.path.unshiftContainer("body", declar);
        }

        return id;
    }

    addHelper(name) {
        const declar = this.declarations[name];
        if (declar) {
            return declar;
        }

        if (!this.usedHelpers[name]) {
            this.metadata.usedHelpers.push(name);
            this.usedHelpers[name] = true;
        }

        const generator = this.get("helperGenerator");
        const runtime = this.get("helpersNamespace");
        if (generator) {
            const res = generator(name);
            if (res) {
                return res;
            }
        } else if (runtime) {
            return types.memberExpression(runtime, types.identifier(name));
        }

        const ref = helpers.get(name);
        const uid = this.declarations[name] = this.scope.generateUidIdentifier(name);

        if (types.isFunctionExpression(ref) && !ref.id) {
            ref.body._compact = true;
            ref._generated = true;
            ref.id = uid;
            ref.type = "FunctionDeclaration";
            this.path.unshiftContainer("body", ref);
        } else {
            ref._compact = true;
            this.scope.push({
                id: uid,
                init: ref,
                unique: true
            });
        }

        return uid;
    }

    addTemplateObject(helperName, strings, raw) {
        // Generate a unique name based on the string literals so we dedupe
        // identical strings used in the program.
        const stringIds = raw.elements.map((string) => {
            return string.value;
        });
        const name = `${helperName}_${raw.elements.length}_${stringIds.join(",")}`;

        const declar = this.declarations[name];
        if (declar) {
            return declar;
        }

        const uid = this.declarations[name] = this.scope.generateUidIdentifier("templateObject");

        const helperId = this.addHelper(helperName);
        const init = types.callExpression(helperId, [strings, raw]);
        init._compact = true;
        this.scope.push({
            id: uid,
            init,
            _blockHoist: 1.9  // This ensures that we don't fail if not using function expression helpers
        });
        return uid;
    }

    buildCodeFrameError(node, msg, Error = SyntaxError) {
        const loc = node && (node.loc || node._loc);

        const err = new Error(msg);

        if (loc) {
            err.loc = loc.start;
        } else {
            traverse(node, errorVisitor, this.scope, err);

            err.message += " (This is an error on an internal node. Probably an internal error";

            if (err.loc) {
                err.message += ". Location has been estimated.";
            }

            err.message += ")";
        }

        return err;
    }

    mergeSourceMap(map) {
        const inputMap = this.opts.inputSourceMap;

        if (inputMap) {
            const inputMapConsumer = sourcemap.createConsumer(inputMap);
            const outputMapConsumer = sourcemap.createConsumer(map);

            const mergedGenerator = sourcemap.createGenerator({
                file: inputMapConsumer.file,
                sourceRoot: inputMapConsumer.sourceRoot
            });

            // This assumes the output map always has a single source, since Babel always compiles
            // a single source file to a single output file.
            const source = outputMapConsumer.sources[0];

            inputMapConsumer.eachMapping((mapping) => {
                const generatedPosition = outputMapConsumer.generatedPositionFor({
                    line: mapping.generatedLine,
                    column: mapping.generatedColumn,
                    source
                });
                if (is.exist(generatedPosition.column)) {
                    mergedGenerator.addMapping({
                        source: mapping.source,

                        original: is.nil(mapping.source) ? null : {
                            line: mapping.originalLine,
                            column: mapping.originalColumn
                        },

                        generated: generatedPosition
                    });
                }
            });

            const mergedMap = mergedGenerator.toJSON();
            inputMap.mappings = mergedMap.mappings;
            return inputMap;
        }
        return map;

    }

    parse(code) {
        let parseCode = parse;
        let parserOpts = this.opts.parserOpts;

        if (parserOpts) {
            parserOpts = Object.assign({}, this.parserOpts, parserOpts);

            if (parserOpts.parser) {
                if (is.string(parserOpts.parser)) {
                    const dirname = path.dirname(this.opts.filename) || process.cwd();
                    const parser = resolve(parserOpts.parser, dirname);
                    if (parser) {
                        parseCode = require(parser).parse;
                    } else {
                        throw new Error(`Couldn't find parser ${parserOpts.parser} with "parse" method relative to directory ${dirname}`);
                    }
                } else {
                    parseCode = parserOpts.parser;
                }

                parserOpts.parser = {
                    parse(source) {
                        return parse(source, parserOpts);
                    }
                };
            }
        }

        this.log.debug("Parse start");
        const ast = parseCode(code, parserOpts || this.parserOpts);
        this.log.debug("Parse stop");
        return ast;
    }

    _addAst(ast) {
        this.path = NodePath.get({
            hub: this.hub,
            parentPath: null,
            parent: ast,
            container: ast,
            key: "program"
        }).setContext();
        this.scope = this.path.scope;
        this.ast = ast;
        this.getMetadata();
    }

    addAst(ast) {
        this.log.debug("Start set AST");
        this._addAst(ast);
        this.log.debug("End set AST");
    }

    transform() {
        // In the "pass per preset" mode, we have grouped passes.
        // Otherwise, there is only one plain pluginPasses array.
        for (let i = 0; i < this.pluginPasses.length; i++) {
            const pluginPasses = this.pluginPasses[i];
            this.call("pre", pluginPasses);
            this.log.debug("Start transform traverse");

            // merge all plugin visitors into a single visitor
            const visitor = traverse.visitors.merge(
                this.pluginVisitors[i],
                pluginPasses,
                this.opts.wrapPluginVisitorMethod
            );
            traverse(this.ast, visitor, this.scope);

            this.log.debug("End transform traverse");
            this.call("post", pluginPasses);
        }

        return this.generate();
    }

    wrap(code, callback) {
        code = String(code);

        try {
            if (this.shouldIgnore()) {
                return this.makeResult({ code, ignored: true });
            }
            return callback();

        } catch (err) {
            if (err._babel) {
                throw err;
            } else {
                err._babel = true;
            }

            let message = err.message = `${this.opts.filename}: ${err.message}`;

            const loc = err.loc;
            if (loc) {
                err.codeFrame = codeFrame(code, loc.line, loc.column + 1, this.opts);
                message += `\n${err.codeFrame}`;
            }

            if (process.browser) {
                // chrome has it's own pretty stringifier which doesn't use the stack property
                // https://github.com/babel/babel/issues/2175
                err.message = message;
            }

            if (err.stack) {
                const newStack = err.stack.replace(err.message, message);
                err.stack = newStack;
            }

            throw err;
        }
    }

    addCode(code) {
        code = `${code || ""}`;
        code = this.parseInputSourceMap(code);
        this.code = code;
    }

    parseCode() {
        this.parseShebang();
        const ast = this.parse(this.code);
        this.addAst(ast);
    }

    shouldIgnore() {
        const opts = this.opts;
        return util.shouldIgnore(opts.filename, opts.ignore, opts.only);
    }

    call(key, pluginPasses) {
        for (const pass of pluginPasses) {
            const plugin = pass.plugin;
            const fn = plugin[key];
            if (fn) {
                fn.call(pass, this);
            }
        }
    }

    parseInputSourceMap(code) {
        const opts = this.opts;

        if (opts.inputSourceMap !== false) {
            const inputMap = sourceMapFromSource(code);
            if (inputMap) {
                opts.inputSourceMap = inputMap;
                code = removeSourceMapComments(code);
            }
        }

        return code;
    }

    parseShebang() {
        const shebangMatch = shebangRegex.exec(this.code);
        if (shebangMatch) {
            this.shebang = shebangMatch[0];
            this.code = this.code.replace(shebangRegex, "");
        }
    }

    makeResult({ code, map, ast, ignored }) {
        const result = {
            metadata: null,
            options: this.opts,
            ignored: Boolean(ignored),
            code: null,
            ast: null,
            map: map || null
        };

        if (this.opts.code) {
            result.code = code;
        }

        if (this.opts.ast) {
            result.ast = ast;
        }

        if (this.opts.metadata) {
            result.metadata = this.metadata;
        }

        return result;
    }

    generate() {
        const opts = this.opts;
        const ast = this.ast;

        const result = { ast };
        if (!opts.code) {
            return this.makeResult(result);
        }

        let gen = generate;
        if (opts.generatorOpts.generator) {
            gen = opts.generatorOpts.generator;

            if (is.string(gen)) {
                const dirname = path.dirname(this.opts.filename) || process.cwd();
                const generator = resolve(gen, dirname);
                if (generator) {
                    gen = require(generator).print;
                } else {
                    throw new Error(`Couldn't find generator ${gen} with "print" method relative to directory ${dirname}`);
                }
            }
        }

        this.log.debug("Generation start");

        const _result = gen(
            ast, opts.generatorOpts ? Object.assign(opts, opts.generatorOpts) : opts, this.code
        );
        result.code = _result.code;
        result.map = _result.map;

        this.log.debug("Generation end");

        if (this.shebang) {
            // add back shebang
            result.code = `${this.shebang}\n${result.code}`;
        }

        if (result.map) {
            result.map = this.mergeSourceMap(result.map);
        }

        if (opts.sourceMaps === "inline" || opts.sourceMaps === "both") {
            result.code += `\n${sourceMapToComment(result.map)}`;
        }

        if (opts.sourceMaps === "inline") {
            result.map = null;
        }

        return this.makeResult(result);
    }
}

export { File };
