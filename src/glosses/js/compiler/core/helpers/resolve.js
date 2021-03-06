const { std: { module: Module, path } } = adone;

const relativeModules = {};

export default function (loc, relative = process.cwd()) {
    let relativeMod = relativeModules[relative];

    if (!relativeMod) {
        relativeMod = new Module();

        // We need to define an id and filename on our "fake" relative` module so that
        // Node knows what "." means in the case of us trying to resolve a plugin
        // such as "./myPlugins/somePlugin.js". If we don't specify id and filename here,
        // Node presumes "." is process.cwd(), not our relative path.
        // Since this fake module is never "loaded", we don't have to worry about mutating
        // any global Node module cache state here.
        const filename = path.join(relative, ".secret");
        relativeMod.id = filename;
        relativeMod.filename = filename;

        relativeMod.paths = Module._nodeModulePaths(relative);
        relativeModules[relative] = relativeMod;
    }

    try {
        return Module._resolveFilename(loc, relativeMod);
    } catch (err) {
        return null;
    }
}
