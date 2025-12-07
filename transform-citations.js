const fs = require("fs");
const path = require("path");

const filePath = path.join(
  __dirname,
  "frontend",
  "src",
  "utils",
  "citations.ts"
);
let content = fs.readFileSync(filePath, "utf8");

// Process line by line using simple string manipulation
const lines = content.split("\n");
const transformedLines = lines.map((line) => {
  const trimmed = line.trim();

  // Check if this looks like a citation line: starts with " and contains " - "
  if (
    trimmed.startsWith('"') &&
    trimmed.includes(" - ") &&
    trimmed.endsWith('",')
  ) {
    // Find the last " - " before the closing quote
    const lastDashIndex = trimmed.lastIndexOf(" - ");
    if (lastDashIndex > 0) {
      const quotePart = trimmed.substring(0, lastDashIndex);
      const authorPart = trimmed.substring(lastDashIndex + 3); // +3 to skip " - "

      // Remove the closing quote and comma from author
      if (authorPart.endsWith('",')) {
        const author = authorPart.slice(0, -2); // Remove '",'
        // Get the leading whitespace from original line
        const leadingWhitespace = line.match(/^\s*/)[0];
        return leadingWhitespace + quotePart + " (" + author + ')",';
      }
    }
  }
  return line;
});

fs.writeFileSync(filePath, transformedLines.join("\n"));
console.log(
  `Processed ${lines.length} lines. Citations transformed successfully!`
);
