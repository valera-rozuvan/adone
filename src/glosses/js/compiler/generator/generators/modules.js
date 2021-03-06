const { js: { compiler: { types } } } = adone;

export const ImportSpecifier = function (node) {
    if (node.importKind === "type" || node.importKind === "typeof") {
        this.word(node.importKind);
        this.space();
    }

    this.print(node.imported, node);
    if (node.local && node.local.name !== node.imported.name) {
        this.space();
        this.word("as");
        this.space();
        this.print(node.local, node);
    }
};

export const ImportDefaultSpecifier = function (node) {
    this.print(node.local, node);
};

export const ExportDefaultSpecifier = function (node) {
    this.print(node.exported, node);
};

export const ExportSpecifier = function (node) {
    this.print(node.local, node);
    if (node.exported && node.local.name !== node.exported.name) {
        this.space();
        this.word("as");
        this.space();
        this.print(node.exported, node);
    }
};

export const ExportNamespaceSpecifier = function (node) {
    this.token("*");
    this.space();
    this.word("as");
    this.space();
    this.print(node.exported, node);
};

export const ExportAllDeclaration = function (node) {
    this.word("export");
    this.space();
    this.token("*");
    this.space();
    this.word("from");
    this.space();
    this.print(node.source, node);
    this.semicolon();
};

const ExportDeclaration = function (node) {
    if (node.declaration) {
        const declar = node.declaration;
        this.print(declar, node);
        if (!types.isStatement(declar)) {
            this.semicolon();
        }
    } else {
        if (node.exportKind === "type") {
            this.word("type");
            this.space();
        }

        const specifiers = node.specifiers.slice(0);

        // print "special" specifiers first
        let hasSpecial = false;
        for (;;) {
            const first = specifiers[0];
            if (types.isExportDefaultSpecifier(first) || types.isExportNamespaceSpecifier(first)) {
                hasSpecial = true;
                this.print(specifiers.shift(), node);
                if (specifiers.length) {
                    this.token(",");
                    this.space();
                }
            } else {
                break;
            }
        }

        if (specifiers.length || (!specifiers.length && !hasSpecial)) {
            this.token("{");
            if (specifiers.length) {
                this.space();
                this.printList(specifiers, node);
                this.space();
            }
            this.token("}");
        }

        if (node.source) {
            this.space();
            this.word("from");
            this.space();
            this.print(node.source, node);
        }

        this.semicolon();
    }
};

export const ExportNamedDeclaration = function (...args) {
    this.word("export");
    this.space();
    ExportDeclaration.apply(this, args);
};

export const ExportDefaultDeclaration = function (...args) {
    this.word("export");
    this.space();
    this.word("default");
    this.space();
    ExportDeclaration.apply(this, args);
};

export const ImportDeclaration = function (node) {
    this.word("import");
    this.space();

    if (node.importKind === "type" || node.importKind === "typeof") {
        this.word(node.importKind);
        this.space();
    }

    const specifiers = node.specifiers.slice(0);
    if (specifiers && specifiers.length) {
        // print "special" specifiers first
        for (;;) {
            const first = specifiers[0];
            if (types.isImportDefaultSpecifier(first) || types.isImportNamespaceSpecifier(first)) {
                this.print(specifiers.shift(), node);
                if (specifiers.length) {
                    this.token(",");
                    this.space();
                }
            } else {
                break;
            }
        }

        if (specifiers.length) {
            this.token("{");
            this.space();
            this.printList(specifiers, node);
            this.space();
            this.token("}");
        }

        this.space();
        this.word("from");
        this.space();
    }

    this.print(node.source, node);
    this.semicolon();
};

export const ImportNamespaceSpecifier = function (node) {
    this.token("*");
    this.space();
    this.word("as");
    this.space();
    this.print(node.local, node);
};
