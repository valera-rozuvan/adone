export default {
    encode(decodedKey) {
        return `\xff${decodedKey[0]}\xff${decodedKey[1]}`;
    },
    decode(encodedKeyAsBuffer) {
        const str = encodedKeyAsBuffer.toString();
        const idx = str.indexOf("\xff", 1);
        return [str.substring(1, idx), str.substring(idx + 1)];
    },
    lowerBound: "\x00",
    upperBound: "\xff"
};
