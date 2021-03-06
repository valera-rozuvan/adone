const { is, x, util: { keys }, shani: { util } } = adone;
const { __ } = util;

// eslint-disable-next-line no-use-before-define
const getParentBehaviour = (stubInstance) => stubInstance.parent && getCurrentBehavior(stubInstance.parent);

const getDefaultBehavior = (stubInstance) => {
    return stubInstance.defaultBehavior || getParentBehaviour(stubInstance) || __.behavior.create(stubInstance);
};

const getCurrentBehavior = (stubInstance) => {
    const currentBehavior = stubInstance.behaviors[stubInstance.callCount - 1];
    return currentBehavior && currentBehavior.isPresent() ? currentBehavior : getDefaultBehavior(stubInstance);
};

let uuid = 0;

const proto = {
    create(stubLength) {
        let functionStub = function (...args) {
            const matchings = functionStub.matchingFakes(args);

            const fnStub = matchings.sort((a, b) => {
                return a.matchingArguments.length - b.matchingArguments.length;
            }).pop() || functionStub;
            return getCurrentBehavior(fnStub).invoke(this, args);
        };

        functionStub.id = `stub#${uuid++}`;
        const orig = functionStub;
        functionStub = util.spy.create(functionStub, stubLength);
        functionStub.func = orig;

        Object.assign(functionStub, stub);
        functionStub.instantiateFake = stub.create;
        functionStub.displayName = "stub";
        functionStub.toString = __.util.functionToString;

        functionStub.defaultBehavior = null;
        functionStub.behaviors = [];

        return functionStub;
    },
    resetBehavior() {
        const fakes = this.fakes || [];

        this.defaultBehavior = null;
        this.behaviors = [];

        delete this.returnValue;
        delete this.returnArgAt;
        delete this.throwArgAt;
        delete this.fakeFn;
        this.returnThis = false;

        fakes.forEach((fake) => {
            fake.resetBehavior();
        });
    },
    resetHistory: util.spy.reset,
    reset() {
        this.resetHistory();
        this.resetBehavior();
    },
    onCall(index) {
        if (!this.behaviors[index]) {
            this.behaviors[index] = __.behavior.create(this);
        }

        return this.behaviors[index];
    },
    onFirstCall() {
        return this.onCall(0);
    },
    onSecondCall() {
        return this.onCall(1);
    },
    onThirdCall() {
        return this.onCall(2);
    }
};

for (const name of keys(__.behavior)) {
    if (__.behavior.hasOwnProperty(name) &&
        !proto.hasOwnProperty(name) &&
        name !== "create" &&
        name !== "withArgs" &&
        name !== "invoke") {
        proto[name] = __.behavior.createBehavior(name);
    }
}

for (const name of keys(__.defaultBehaviors)) {
    if (__.defaultBehaviors.hasOwnProperty(name) && !proto.hasOwnProperty(name)) {
        __.behavior.addBehavior(stub, name, __.defaultBehaviors[name]);
    }
}

export default function stub(object, property, descriptor) {
    __.throwOnFalsyObject(object, property, descriptor);

    const actualDescriptor = __.util.getPropertyDescriptor(object, property);
    const isStubbingEntireObject = is.undefined(property) && is.object(object) && !is.function(object);
    const isCreatingNewStub = !object && is.undefined(property);
    const isStubbingDescriptor = object && property && Boolean(descriptor);

    const isStubbingNonFuncProperty = is.object(object)
        && !is.undefined(property)
        && (is.undefined(actualDescriptor) || !is.function(actualDescriptor.value)) &&
        is.undefined(descriptor);

    const isStubbingExistingMethod = !isStubbingDescriptor &&
        is.object(object) &&
        !is.undefined(actualDescriptor) &&
        is.function(actualDescriptor.value);

    const arity = isStubbingExistingMethod ? object[property].length : 0;

    if (isStubbingEntireObject) {
        return __.stubEntireObject(stub, object);
    }

    if (isStubbingDescriptor) {
        return __.stubDescriptor(object, property, descriptor);
    }

    if (isCreatingNewStub) {
        return stub.create();
    }

    const s = stub.create(arity);
    s.rootObj = object;
    s.propName = property;
    s.restore = function restore() {
        if (!is.undefined(actualDescriptor)) {
            Object.defineProperty(object, property, actualDescriptor);
            return;
        }

        delete object[property];
    };

    return isStubbingNonFuncProperty ? s : __.util.wrapMethod(object, property, s);
}

stub.createStubInstance = function (constructor) {
    if (!is.function(constructor)) {
        throw new x.InvalidArgument("The constructor should be a function.");
    }
    return stub(Object.create(constructor.prototype));
};

Object.assign(stub, proto);
