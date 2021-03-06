const TARGET_TYPES = ["html", "jade", "pug", "slm", "slim", "jsx", "haml", "less", "sass", "scss"];
const IMAGES = ["jpeg", "jpg", "png", "gif"];
const DEFAULT_TARGET = TARGET_TYPES[0];

const { util } = adone;

const typeFromExt = (ext) => {
    if (IMAGES.includes(ext.toLowerCase())) {
        return "image";
    }
    return ext;
};

const end = () => {
    return transform.selfClosingTag ? " />" : ">";
};


export default function transform(...args) {
    const [, , , , targetFile] = args;
    let type;
    if (targetFile && targetFile.path) {
        type = typeFromExt(targetFile.extname.slice(1));
    }
    if (!TARGET_TYPES.includes(type)) {
        type = DEFAULT_TARGET;
    }
    const func = transform[type];
    if (func) {
        return func.apply(transform, args);
    }
}

transform.selfClosingTag = false;

TARGET_TYPES.forEach((targetType) => {
    transform[targetType] = function (...args) {
        const ext = adone.std.path.extname(args[0]).slice(1);
        const type = typeFromExt(ext);
        const func = transform[targetType][type];
        if (func) {
            return func.apply(transform[targetType], args);
        }
    };
});

transform.html.css = function (filepath) {
    return `<link rel="stylesheet" href="${filepath}"${end()}`;
};

transform.html.js = function (filepath) {
    return `<script src="${filepath}"></script>`;
};
transform.html.map = transform.html.js;

transform.html.jsx = function (filepath) {
    return `<script type="text/jsx" src="${filepath}"></script>`;
};

transform.html.html = function (filepath) {
    return `<link rel="import" href="${filepath}"${end()}`;
};

transform.html.coffee = function (filepath) {
    return `<script type="text/coffeescript" src="${filepath}"></script>`;
};

transform.html.image = function (filepath) {
    return `<img src="${filepath}"${end()}`;
};

transform.jade.css = function (filepath) {
    return `link(rel="stylesheet", href="${filepath}")`;
};

transform.jade.js = function (filepath) {
    return `script(src="${filepath}")`;
};

transform.jade.jsx = function (filepath) {
    return `script(type="text/jsx", src="${filepath}")`;
};

transform.jade.jade = function (filepath) {
    return `include ${filepath}`;
};

transform.jade.html = function (filepath) {
    return `link(rel="import", href="${filepath}")`;
};

transform.jade.coffee = function (filepath) {
    return `script(type="text/coffeescript", src="${filepath}")`;
};

transform.jade.image = function (filepath) {
    return `img(src="${filepath}")`;
};

transform.pug.css = function (filepath) {
    return `link(rel="stylesheet", href="${filepath}")`;
};

transform.pug.js = function (filepath) {
    return `script(src="${filepath}")`;
};

transform.pug.jsx = function (filepath) {
    return `script(type="text/jsx", src="${filepath}")`;
};

transform.pug.pug = function (filepath) {
    return `include ${filepath}`;
};

transform.pug.html = function (filepath) {
    return `link(rel="import", href="${filepath}")`;
};

transform.pug.coffee = function (filepath) {
    return `script(type="text/coffeescript", src="${filepath}")`;
};

transform.pug.image = function (filepath) {
    return `img(src="${filepath}")`;
};

transform.slm.css = function (filepath) {
    return `link rel="stylesheet" href="${filepath}"`;
};

transform.slm.js = function (filepath) {
    return `script src="${filepath}"`;
};

transform.slm.html = function (filepath) {
    return `link rel="import" href="${filepath}"`;
};

transform.slm.coffee = function (filepath) {
    return `script type="text/coffeescript" src="${filepath}"`;
};

transform.slm.image = function (filepath) {
    return `img src="${filepath}"`;
};

transform.slim.css = transform.slm.css;
transform.slim.js = transform.slm.js;
transform.slim.html = transform.slm.html;
transform.slim.coffee = transform.slm.coffee;
transform.slim.image = transform.slm.image;

transform.haml.css = function (filepath) {
    return `%link{rel:"stylesheet", href:"${filepath}"}`;
};

transform.haml.js = function (filepath) {
    return `%script{src:"${filepath}"}`;
};

transform.haml.html = function (filepath) {
    return `%link{rel:"import", href:"${filepath}"}`;
};

transform.haml.coffee = function (filepath) {
    return `%script{type:"text/coffeescript", src:"${filepath}"}`;
};

transform.haml.image = function (filepath) {
    return `%img{src:"${filepath}"}`;
};

transform.less.less = function (filepath) {
    return `@import "${filepath}";`;
};

transform.less.css = transform.less.less;

transform.sass.sass = function (filepath) {
    return `@import "${filepath}"`;
};

transform.sass.scss = transform.sass.sass;
transform.sass.css = transform.sass.sass;

transform.scss.sass = transform.less.less;
transform.scss.scss = transform.scss.sass;
transform.scss.css = transform.scss.sass;

/**
 * Transformations for jsx is like html
 * but always with self closing tags, invalid jsx otherwise
 */
util.keys(transform.html).forEach((type) => {
    transform.jsx[type] = function (...args) {
        const originalOption = transform.selfClosingTag;
        transform.selfClosingTag = true;
        const result = transform.html[type].apply(transform.html, args);
        transform.selfClosingTag = originalOption;
        return result;
    };
});
