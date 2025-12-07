import re

file_path = 'frontend/src/utils/citations.ts'

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Replace pattern: "text - author", with "text (author)",
# Match: quote, text, " - ", author, closing quote and comma
pattern = r'(".*?)\s+-\s+(.*?)(",)'

def replace_citation(match):
    quote_part = match.group(1)  # Everything before " - "
    author_part = match.group(2)  # The author name
    closing = match.group(3)      # The ", at the end
    return f'{quote_part} ({author_part}){closing}'

content = re.sub(pattern, replace_citation, content)

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)

print('Citations transformed successfully!')
