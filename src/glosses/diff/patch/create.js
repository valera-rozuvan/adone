const { is, diff: { lines: diffLines } } = adone;

export const structuredPatch = (oldFileName, newFileName, oldStr, newStr, oldHeader, newHeader, options = {}) => {
    if (is.undefined(options.context)) {
        options.context = 4;
    }

    const diff = diffLines(oldStr, newStr, options);
    diff.push({ value: "", lines: [] }); // Append an empty value to make cleanup easier

    const contextLines = (lines) => lines.map((entry) => ` ${entry}`);

    const hunks = [];
    let oldRangeStart = 0;
    let newRangeStart = 0;
    let curRange = [];
    let oldLine = 1;
    let newLine = 1;

    for (let i = 0; i < diff.length; i++) {
        const current = diff[i];
        const lines = current.lines || current.value.replace(/\n$/, "").split("\n");

        current.lines = lines;

        if (current.added || current.removed) {
            // If we have previous context, start with that
            if (!oldRangeStart) {
                const prev = diff[i - 1];
                oldRangeStart = oldLine;
                newRangeStart = newLine;

                if (prev) {
                    curRange = options.context > 0 ? contextLines(prev.lines.slice(-options.context)) : [];
                    oldRangeStart -= curRange.length;
                    newRangeStart -= curRange.length;
                }
            }

            // Output our changes
            curRange.push(...lines.map((entry) => {
                return (current.added ? "+" : "-") + entry;
            }));

            // Track the updated file position
            if (current.added) {
                newLine += lines.length;
            } else {
                oldLine += lines.length;
            }
        } else {
            // Identical context lines. Track line changes
            if (oldRangeStart) {
                // Close out any changes that have been output (or join overlapping)
                if (lines.length <= options.context * 2 && i < diff.length - 2) {
                    // Overlapping
                    curRange.push(...contextLines(lines));
                } else {
                    // end the range and output
                    const contextSize = Math.min(lines.length, options.context);
                    curRange.push(...contextLines(lines.slice(0, contextSize)));

                    const hunk = {
                        oldStart: oldRangeStart,
                        oldLines: oldLine - oldRangeStart + contextSize,
                        newStart: newRangeStart,
                        newLines: newLine - newRangeStart + contextSize,
                        lines: curRange
                    };
                    if (i >= diff.length - 2 && lines.length <= options.context) {
                        // EOF is inside this hunk
                        const oldEOFNewline = /\n$/.test(oldStr);
                        const newEOFNewline = /\n$/.test(newStr);
                        if (lines.length === 0 && !oldEOFNewline) {
                            // special case: old has no eol and no trailing context; no-nl can end up before adds
                            curRange.splice(hunk.oldLines, 0, "\\ No newline at end of file");
                        } else if (!oldEOFNewline || !newEOFNewline) {
                            curRange.push("\\ No newline at end of file");
                        }
                    }
                    hunks.push(hunk);

                    oldRangeStart = 0;
                    newRangeStart = 0;
                    curRange = [];
                }
            }
            oldLine += lines.length;
            newLine += lines.length;
        }
    }

    return {
        oldFileName,
        newFileName,
        oldHeader,
        newHeader,
        hunks
    };
};

export const createTwoFilesPatch = (oldFileName, newFileName, oldStr, newStr, oldHeader, newHeader, options) => {
    const diff = structuredPatch(oldFileName, newFileName, oldStr, newStr, oldHeader, newHeader, options);

    const ret = [];
    if (oldFileName === newFileName) {
        ret.push(`Index: ${oldFileName}`);
    }
    ret.push("===================================================================");
    ret.push(`--- ${diff.oldFileName}${is.undefined(diff.oldHeader) ? "" : `\t${diff.oldHeader}`}`);
    ret.push(`+++ ${diff.newFileName}${is.undefined(diff.newHeader) ? "" : `\t${diff.newHeader}`}`);

    for (const hunk of diff.hunks) {
        ret.push(`@@ -${hunk.oldStart},${hunk.oldLines} +${hunk.newStart},${hunk.newLines} @@`);
        ret.push.apply(ret, hunk.lines);
    }

    return `${ret.join("\n")}\n`;
};

export const createPatch = (fileName, oldStr, newStr, oldHeader, newHeader, options) => {
    return createTwoFilesPatch(fileName, fileName, oldStr, newStr, oldHeader, newHeader, options);
};
