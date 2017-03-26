const { is, std, fs, util } = adone;

const configRelativePath = "defaults/configs/adone.js".replace(/\//g, std.path.sep);

const getArch = () => {
    const arch = process.arch;
    switch (arch) {
        case "ia32": return "x86";
        default: return arch;
    }
};

const getPlatform = () => {
    const platform = process.platform;
    switch (platform) {
        case "win32": return "win";
        default: return platform;
    }
};

export default class AdoneManager {
    constructor() {
        this.app = adone.appinstance;
        this.scriptName = is.win32 ? "adone.cmd" : "adone";
        this.nodePath = std.path.dirname(process.execPath);
        this.adoneScriptPath = std.path.join(this.nodePath, this.scriptName);
        this.nodeModulesDir = new fs.Directory(std.path.resolve(fs.homeDir(), ".node_modules"));
        this.destAdoneDir = this.nodeModulesDir.getDirectory("adone");
        this.adoneVersion = adone.package.version;
        this.name = `${getPlatform()}-${getArch()}.tar`;
    }

    async install() {
        const targets = this.getTargets();
        await this.destAdoneDir.create();
        await adone.fast.src(targets, { base: this.app.adoneRootPath }).dest(this.destAdoneDir.path());

        return this.installScript();
    }

    async installLink() {
        await this.nodeModulesDir.create();

        if (is.win32) {
            await fs.symlink(this.app.adoneRootPath, this.destAdoneDir.path(), "junction");
        } else {
            await fs.symlink(this.app.adoneRootPath, this.destAdoneDir.path());
        }

        return this.installScript();
    }

    async installScript() {
        const data = adone.templating.nunjucks.render(std.path.join(this.app.adoneDefaultsPath, "scripts", this.scriptName), { targetPath: this.destAdoneDir.resolve("bin", "adone.js") });
        await adone.fs.writeFile(this.adoneScriptPath, data);
        if (!is.win32) {
            await adone.fs.chmod(this.adoneScriptPath, 0o755);
        }
    }

    async uninstall() {
        if (await this.destAdoneDir.exists()) {
            // Temporary backup whole adone directory.
            const backupPath = await fs.tmpName();
            await this.destAdoneDir.copyTo(backupPath);
            try {
                await this.destAdoneDir.unlink();
            } catch (err) {
                // Recovery files in case of unsuccessful deletion.
                await this.destAdoneDir.copyFrom(backupPath, { ignoreExisting: true });
                throw err;
            }
        }

        try {
            await adone.fs.unlink(this.adoneScriptPath);
        } catch (err) {
        }
    }

    getArchiveName(type) {
        return `${this.name}.${type}`;
    }

    async createArchive(outPath, { env, dirName, type = "gz" } = {}) {
        return adone.fast
            .src(this.getTargets(), { base: this.app.adoneRootPath })
            .if((f) => f.relative === configRelativePath, adone.fast.plugin.replace(["\"development\"", "\".adone_dev\""], [`"${env}"`, `"${dirName}"`]))
            .pack("tar", this.name)
            .compress(type)
            .dest(outPath);
    }

    getTargets() {
        return ["!**/*.map", "package.json", "README*", "LICENSE*"].concat(["bin", "lib", "defaults"].map((x) => util.globize(x, { recursively: true })));
    }
}
