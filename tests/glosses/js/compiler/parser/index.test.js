import { multiple as getFixtures } from "../helper_fixture";
const { is, std: { fs, path } } = adone;


const save = (test, ast) => {
    delete ast.tokens;
    if (ast.comments && !ast.comments.length) {
        delete ast.comments;
    }
    fs.writeFileSync(test.expect.loc, JSON.stringify(ast, null, "  "));
};

const ppJSON = (v) => {
    v = v instanceof RegExp ? v.toString() : v;
    return JSON.stringify(v, null, 2);
};

const addPath = (str, pt) => {
    if (str[str.length - 1] === ")") {
        return `${str.slice(0, str.length - 1)}/${pt})`;
    }
    return `${str} (${pt})`;

};

const misMatch = (exp, act) => {
    if (exp instanceof RegExp || act instanceof RegExp) {
        const left = ppJSON(exp);
        const right = ppJSON(act);
        if (left !== right) {
            return `${left} !== ${right}`;
        }
    } else if (is.array(exp)) {
        if (!is.array(act)) {
            return `${ppJSON(exp)} != ${ppJSON(act)}`;
        }
        if (act.length !== exp.length) {
            return `array length mismatch ${exp.length} != ${act.length}`;
        }
        for (let i = 0; i < act.length; ++i) {
            const mis = misMatch(exp[i], act[i]);
            if (mis) {
                return addPath(mis, i);
            }
        }
    } else if (!exp || !act || (!is.object(exp)) || (!is.object(act))) {
        if (exp !== act && !is.function(exp)) {
            return `${ppJSON(exp)} !== ${ppJSON(act)}`;
        }
    } else {
        for (const prop in exp) {
            const mis = misMatch(exp[prop], act[prop]);
            if (mis) {
                return addPath(mis, prop);
            }
        }
    }
};


const runTest = (test, parseFunction) => {
    const opts = test.options;
    opts.locations = true;
    opts.ranges = true;

    if (opts.throws && test.expect.code) {
        throw new Error("File expected.json exists although options specify throws. Remove expected.json.");
    }
    let ast;
    try {
        ast = parseFunction(test.actual.code, opts);
    } catch (err) {
        if (opts.throws) {
            if (err.message === opts.throws) {
                return;
            }
            err.message = `Expected error message: ${opts.throws}. Got error message: ${err.message}`;
            throw err;

        }

        throw err;
    }

    if (!test.expect.code && !opts.throws && !process.env.CI) {
        test.expect.loc += "on";
        return save(test, ast);
    }

    if (opts.throws) {
        throw new Error(`Expected error message: ${opts.throws}. But parsing succeeded.`);
    } else {
        const mis = misMatch(JSON.parse(test.expect.code), ast);
        if (mis) {
            //save(test, ast);
            throw new Error(mis);
        }
    }
};

const runFixtureTests = (fixtures, parseFunction) => {
    for (const [name, suites] of adone.util.entries(fixtures)) {
        for (const suite of suites) {
            for (const task of suite.tests) {
                const test = specify(`${name}/${suite.title}/${task.title}`, () => {
                    try {
                        runTest(task, parseFunction);
                    } catch (err) {
                        err.message = `${name}/${task.actual.filename}:${err.message}`;
                        throw err;
                    }
                });
                if (task.disabled) {
                    test.skip();
                }
            }
        }
    }
};

const runThrowTestsWithEstree = (fixturesPath, parseFunction) => {
    const fixtures = getFixtures(fixturesPath);

    Object.keys(fixtures).forEach((name) => {
        fixtures[name].forEach((testSuite) => {
            testSuite.tests.forEach((task) => {
                if (!task.options.throws) {
                    return;
                }

                task.options.plugins = task.options.plugins || [];
                task.options.plugins.push("estree");

                const testFn = task.disabled ? it.skip : task.options.only ? it.only : it;

                testFn(`${name}/${testSuite.title}/${task.title}`, () => {
                    try {
                        return runTest(task, parseFunction);
                    } catch (err) {
                        err.message = `${task.actual.loc}: ${err.message}`;
                        throw err;
                    }
                });
            });
        });
    });
};

describe("js", "compiler", "parser", () => {
    describe("fixtures", () => {
        const fixtures = getFixtures(path.join(__dirname, "fixtures"));
        runFixtureTests(fixtures, adone.js.compiler.parse);
    });

    describe("expressions", () => {
        const fixtures = getFixtures(path.join(__dirname, "expressions"));
        runFixtureTests(fixtures, adone.js.compiler.parseExpression);
    });

    describe("estree", () => {
        const fixtures = path.join(__dirname, "fixtures");
        runThrowTestsWithEstree(fixtures, adone.js.compiler.parse);
    });
});
