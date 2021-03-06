const { x } = adone;

export const parsePatch = (uniDiff, options = {}) => {
    const diffstr = uniDiff.split(/\r\n|[\n\v\f\r\x85]/);
    const delimiters = uniDiff.match(/\r\n|[\n\v\f\r\x85]/g) || [];
    const list = [];
    let i = 0;

    // Parses the --- and +++ headers, if none are found, no lines
    // are consumed.
    const parseFileHeader = (index) => {
        const headerPattern = /^(---|\+\+\+)\s+([\S ]*)(?:\t(.*?)\s*)?$/;
        const fileHeader = headerPattern.exec(diffstr[i]);
        if (fileHeader) {
            const keyPrefix = fileHeader[1] === "---" ? "old" : "new";
            let fileName = fileHeader[2].replace(/\\\\/g, "\\");
            if (fileName.startsWith('"') && fileName.endsWith('"')) {
                fileName = fileName.substr(1, fileName.length - 2);
            }
            index[`${keyPrefix}FileName`] = fileName;
            index[`${keyPrefix}Header`] = fileHeader[3];

            i++;
        }
    };

    // Parses a hunk
    // This assumes that we are at the start of a hunk.
    const parseHunk = () => {
        const chunkHeaderIndex = i;
        const chunkHeaderLine = diffstr[i++];
        const chunkHeader = chunkHeaderLine.split(/@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/);

        const hunk = {
            oldStart: Number(chunkHeader[1]),
            oldLines: Number(chunkHeader[2]) || 1,
            newStart: Number(chunkHeader[3]),
            newLines: Number(chunkHeader[4]) || 1,
            lines: [],
            linedelimiters: []
        };

        let addCount = 0;
        let removeCount = 0;

        for (; i < diffstr.length; i++) {
            // Lines starting with '---' could be mistaken for the "remove line" operation
            // But they could be the header for the next file. Therefore prune such cases out.
            if (diffstr[i].indexOf("--- ") === 0 && i + 2 < diffstr.length && diffstr[i + 1].indexOf("+++ ") === 0 && diffstr[i + 2].indexOf("@@") === 0) {
                break;
            }
            const operation = diffstr[i][0];

            if (operation === "+" || operation === "-" || operation === " " || operation === "\\") {
                hunk.lines.push(diffstr[i]);
                hunk.linedelimiters.push(delimiters[i] || "\n");

                if (operation === "+") {
                    addCount++;
                } else if (operation === "-") {
                    removeCount++;
                } else if (operation === " ") {
                    addCount++;
                    removeCount++;
                }
            } else {
                break;
            }
        }

        // Handle the empty block count case
        if (!addCount && hunk.newLines === 1) {
            hunk.newLines = 0;
        }
        if (!removeCount && hunk.oldLines === 1) {
            hunk.oldLines = 0;
        }

        // Perform optional sanity checking
        if (options.strict) {
            if (addCount !== hunk.newLines) {
                throw new x.IllegalState(`Added line count did not match for hunk at line ${chunkHeaderIndex + 1}`);
            }
            if (removeCount !== hunk.oldLines) {
                throw new x.IllegalState(`Removed line count did not match for hunk at line ${chunkHeaderIndex + 1}`);
            }
        }

        return hunk;
    };

    const parseIndex = () => {
        const index = {};
        list.push(index);

        // Parse diff metadata
        while (i < diffstr.length) {
            const line = diffstr[i];

            // File header found, end parsing diff metadata
            if (/^(\-\-\-|\+\+\+|@@)\s/.test(line)) {
                break;
            }

            // Diff index
            const header = /^(?:Index:|diff(?: -r \w+)+)\s+(.+?)\s*$/.exec(line);
            if (header) {
                index.index = header[1];
            }

            i++;
        }

        // Parse file headers if they are defined. Unified diff requires them, but
        // there's no technical issues to have an isolated hunk without file header
        parseFileHeader(index);
        parseFileHeader(index);

        // Parse hunks
        index.hunks = [];

        while (i < diffstr.length) {
            const line = diffstr[i];

            if (/^(Index:|diff|\-\-\-|\+\+\+)\s/.test(line)) {
                break;
            } else if (/^@@/.test(line)) {
                index.hunks.push(parseHunk());
            } else if (line && options.strict) {
                // Ignore unexpected content unless in strict mode
                throw new x.Unknown(`Unknown line ${i + 1} ${JSON.stringify(line)}`);
            } else {
                i++;
            }
        }
    };

    while (i < diffstr.length) {
        parseIndex();
    }

    return list;
};
