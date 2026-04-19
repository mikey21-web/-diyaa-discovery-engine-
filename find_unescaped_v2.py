import os
import re

def find_unescaped_quotes(directory):
    # Regex for literal double quote not part of an attribute or property
    # It looks for '"' that is preceded by something other than '=' or ':' (optionally with whitespace)
    # and is inside a JSX structure (roughly between > and <)
    pattern = re.compile(r'>[^<{]*"[^>}]*<')
    
    for root, dirs, files in os.walk(directory):
        if 'node_modules' in root or '.next' in root:
            continue
        for file in files:
            if file.endswith('.tsx'):
                path = os.path.join(root, file)
                with open(path, 'r', encoding='utf-8') as f:
                    try:
                        content = f.read()
                        matches = pattern.finditer(content)
                        for match in matches:
                            start = match.start()
                            line_no = content[:start].count('\n') + 1
                            print(f"{path}:{line_no}: {match.group()}")
                    except:
                        pass

if __name__ == "__main__":
    find_unescaped_quotes('.')
