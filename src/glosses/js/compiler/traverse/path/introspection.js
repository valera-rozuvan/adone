// This file contains methods responsible for introspecting the current path for certain values.
const { is, js: { compiler: { types: t } } } = adone;

/**
 * Match the current node if it matches the provided `pattern`.
 *
 * For example, given the match `React.createClass` it would match the
 * parsed nodes of `React.createClass` and `React["createClass"]`.
 */
export const matchesPattern = function (pattern, allowPartial) {
    // not a member expression
    if (!this.isMemberExpression()) {
        return false;
    }

    const parts = pattern.split(".");
    const search = [this.node];
    let i = 0;

    const matches = function (name) {
        const part = parts[i];
        return part === "*" || name === part;
    };

    while (search.length) {
        const node = search.shift();

        if (allowPartial && i === parts.length) {
            return true;
        }

        if (t.isIdentifier(node)) {
            // this part doesn't match
            if (!matches(node.name)) {
                return false;
            }
        } else if (t.isLiteral(node)) {
            // this part doesn't match
            if (!matches(node.value)) {
                return false;
            }
        } else if (t.isMemberExpression(node)) {
            if (node.computed && !t.isLiteral(node.property)) {
                // we can't deal with this
                return false;
            }
            search.unshift(node.property);
            search.unshift(node.object);
            continue;

        } else if (t.isThisExpression(node)) {
            if (!matches("this")) {
                return false;
            }
        } else {
            // we can't deal with this
            return false;
        }

        // too many parts
        if (++i > parts.length) {
            return false;
        }
    }

    return i === parts.length;
};

/**
 * Check whether we have the input `key`. If the `key` references an array then we check
 * if the array has any items, otherwise we just check if it's falsy.
 */
export const has = function (key) {
    const val = this.node && this.node[key];
    if (val && is.array(val)) {
        return Boolean(val.length);
    }
    return Boolean(val);

};

/**
 * Description
 */
export const isStatic = function () {
    return this.scope.isStatic(this.node);
};

/**
 * Alias of `has`.
 */
export { has as is };

/**
 * Opposite of `has`.
 */
export const isnt = function (key) {
    return !this.has(key);
};

/**
 * Check whether the path node `key` strict equals `value`.
 */
export const equals = function (key, value) {
    return this.node[key] === value;
};

/**
 * Check the type against our stored internal type of the node. This is handy when a node has
 * been removed yet we still internally know the type and need it to calculate node replacement.
 */
export const isNodeType = function (type) {
    return t.isType(this.type, type);
};

/**
 * This checks whether or not we're in one of the following positions:
 *
 *   for (KEY in right);
 *   for (KEY;;);
 *
 * This is because these spots allow VariableDeclarations AND normal expressions so we need
 * to tell the path replacement that it's ok to replace this with an expression.
 */
export const canHaveVariableDeclarationOrExpression = function () {
    return (this.key === "init" || this.key === "left") && this.parentPath.isFor();
};

/**
 * This checks whether we are swapping an arrow function's body between an
 * expression and a block statement (or vice versa).
 *
 * This is because arrow functions may implicitly return an expression, which
 * is the same as containing a block statement.
 */
export const canSwapBetweenExpressionAndStatement = function (replacement) {
    if (this.key !== "body" || !this.parentPath.isArrowFunctionExpression()) {
        return false;
    }

    if (this.isExpression()) {
        return t.isBlockStatement(replacement);
    } else if (this.isBlockStatement()) {
        return t.isExpression(replacement);
    }

    return false;
};

/**
 * Check whether the current path references a completion record
 */
export const isCompletionRecord = function (allowInsideFunction) {
    let path = this;
    let first = true;

    for ( ; ; ) {
        const container = path.container;

        // we're in a function so can't be a completion record
        if (path.isFunction() && !first) {
            return Boolean(allowInsideFunction);
        }

        first = false;

        // check to see if we're the last item in the container and if we are
        // we're a completion record!
        if (is.array(container) && path.key !== container.length - 1) {
            return false;
        }
        path = path.parentPath;
        if (!path) {
            break;
        }
        if (path.isProgram()) {
            break;
        }
    }

    return true;
};

/**
 * Check whether or not the current `key` allows either a single statement or block statement
 * so we can explode it if necessary.
 */
export const isStatementOrBlock = function () {
    if (this.parentPath.isLabeledStatement() || t.isBlockStatement(this.container)) {
        return false;
    }
    return Object.keys(t.STATEMENT_OR_BLOCK_KEYS).includes(this.key);

};

/**
 * Check if the currently assigned path references the `importName` of `moduleSource`.
 */
export const referencesImport = function (moduleSource, importName) {
    if (!this.isReferencedIdentifier()) {
        return false;
    }

    const binding = this.scope.getBinding(this.node.name);
    if (!binding || binding.kind !== "module") {
        return false;
    }

    const path = binding.path;
    const parent = path.parentPath;
    if (!parent.isImportDeclaration()) {
        return false;
    }

    // check moduleSource
    if (parent.node.source.value === moduleSource) {
        if (!importName) {
            return true;
        }
    } else {
        return false;
    }

    if (path.isImportDefaultSpecifier() && importName === "default") {
        return true;
    }

    if (path.isImportNamespaceSpecifier() && importName === "*") {
        return true;
    }

    if (path.isImportSpecifier() && path.node.imported.name === importName) {
        return true;
    }

    return false;
};

/**
 * Get the source code associated with this node.
 */
export const getSource = function () {
    const node = this.node;
    if (node.end) {
        return this.hub.file.code.slice(node.start, node.end);
    }
    return "";

};

export const willIMaybeExecuteBefore = function (target) {
    return this._guessExecutionStatusRelativeTo(target) !== "after";
};

/**
 * Given a `target` check the execution status of it relative to the current path.
 *
 * "Execution status" simply refers to where or not we **think** this will execuete
 * before or after the input `target` element.
 */
export const _guessExecutionStatusRelativeTo = function (target) {
    // check if the two paths are in different functions, we can't track execution of these
    const targetFuncParent = target.scope.getFunctionParent();
    const selfFuncParent = this.scope.getFunctionParent();

    // here we check the `node` equality as sometimes we may have different paths for the
    // same node due to path thrashing
    if (targetFuncParent.node !== selfFuncParent.node) {
        const status = this._guessExecutionStatusRelativeToDifferentFunctions(targetFuncParent);
        if (status) {
            return status;
        }
        target = targetFuncParent.path;

    }

    const targetPaths = target.getAncestry();
    if (targetPaths.indexOf(this) >= 0) {
        return "after";
    }

    const selfPaths = this.getAncestry();

    // get ancestor where the branches intersect
    let commonPath;
    let targetIndex;
    let selfIndex;
    for (selfIndex = 0; selfIndex < selfPaths.length; selfIndex++) {
        const selfPath = selfPaths[selfIndex];
        targetIndex = targetPaths.indexOf(selfPath);
        if (targetIndex >= 0) {
            commonPath = selfPath;
            break;
        }
    }
    if (!commonPath) {
        return "before";
    }

    // get the relationship paths that associate these nodes to their common ancestor
    const targetRelationship = targetPaths[targetIndex - 1];
    const selfRelationship = selfPaths[selfIndex - 1];
    if (!targetRelationship || !selfRelationship) {
        return "before";
    }

    // container list so let's see which one is after the other
    if (targetRelationship.listKey && targetRelationship.container === selfRelationship.container) {
        return targetRelationship.key > selfRelationship.key ? "before" : "after";
    }

    // otherwise we're associated by a parent node, check which key comes before the other
    const targetKeyPosition = t.VISITOR_KEYS[targetRelationship.type].indexOf(targetRelationship.key);
    const selfKeyPosition = t.VISITOR_KEYS[selfRelationship.type].indexOf(selfRelationship.key);
    return targetKeyPosition > selfKeyPosition ? "before" : "after";
};

export const _guessExecutionStatusRelativeToDifferentFunctions = function (targetFuncParent) {
    const targetFuncPath = targetFuncParent.path;
    if (!targetFuncPath.isFunctionDeclaration()) {
        return;
    }

    // so we're in a completely different function, if this is a function declaration
    // then we can be a bit smarter and handle cases where the function is either
    // a. not called at all (part of an export)
    // b. called directly
    const binding = targetFuncPath.scope.getBinding(targetFuncPath.node.id.name);

    // no references!
    if (!binding.references) {
        return "before";
    }

    const referencePaths = binding.referencePaths;

    // verify that all of the references are calls
    for (const path of referencePaths) {
        if (path.key !== "callee" || !path.parentPath.isCallExpression()) {
            return;
        }
    }

    let allStatus;

    // verify that all the calls have the same execution status
    for (const path of referencePaths) {
        // if a reference is a child of the function we're checking against then we can
        // safelty ignore it
        const childOfFunction = Boolean(path.find((path) => path.node === targetFuncPath.node));
        if (childOfFunction) {
            continue;
        }

        const status = this._guessExecutionStatusRelativeTo(path);

        if (allStatus) {
            if (allStatus !== status) {
                return;
            }
        } else {
            allStatus = status;
        }
    }

    return allStatus;
};

/**
 * Resolve a "pointer" `NodePath` to it's absolute path.
 */
export const resolve = function (dangerous, resolved) {
    return this._resolve(dangerous, resolved) || this;
};

export const _resolve = function (dangerous, resolved) {
    // detect infinite recursion
    // todo: possibly have a max length on this just to be safe
    if (resolved && resolved.indexOf(this) >= 0) {
        return;
    }

    // we store all the paths we've "resolved" in this array to prevent infinite recursion
    resolved = resolved || [];
    resolved.push(this);

    if (this.isVariableDeclarator()) {
        if (this.get("id").isIdentifier()) {
            return this.get("init").resolve(dangerous, resolved);
        }
            // otherwise it's a request for a pattern and that's a bit more tricky

    } else if (this.isReferencedIdentifier()) {
        const binding = this.scope.getBinding(this.node.name);
        if (!binding) {
            return;
        }

        // reassigned so we can't really resolve it
        if (!binding.constant) {
            return;
        }

        // todo - lookup module in dependency graph
        if (binding.kind === "module") {
            return;
        }

        if (binding.path !== this) {
            const ret = binding.path.resolve(dangerous, resolved);
            // If the identifier resolves to parent node then we can't really resolve it.
            if (this.find((parent) => parent.node === ret.node)) {
                return;
            }
            return ret;
        }
    } else if (this.isTypeCastExpression()) {
        return this.get("expression").resolve(dangerous, resolved);
    } else if (dangerous && this.isMemberExpression()) {
        // this is dangerous, as non-direct target assignments will mutate it's state
        // making this resolution inaccurate

        const targetKey = this.toComputedKey();
        if (!t.isLiteral(targetKey)) {
            return;
        }

        const targetName = targetKey.value;

        const target = this.get("object").resolve(dangerous, resolved);

        if (target.isObjectExpression()) {
            const props = target.get("properties");
            for (const prop of props) {
                if (!prop.isProperty()) {
                    continue;
                }

                const key = prop.get("key");

                // { foo: obj }
                let match = prop.isnt("computed") && key.isIdentifier({ name: targetName });

                // { "foo": "obj" } or { ["foo"]: "obj" }
                match = match || key.isLiteral({ value: targetName });

                if (match) {
                    return prop.get("value").resolve(dangerous, resolved);
                }
            }
        } else if (target.isArrayExpression() && !is.nan(Number(targetName))) {
            const elems = target.get("elements");
            const elem = elems[targetName];
            if (elem) {
                return elem.resolve(dangerous, resolved);
            }
        }
    }
};
