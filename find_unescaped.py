import os
import re

def find_unescaped_entities(directory):
    pattern = re.compile(r'>[^<{]*"[^>}]*<')
    for root, dirs, files in os.walk(directory):
        if 'node_modules' in root or '.next' in root:
            continue
        for file in files:
            if file.endswith('.tsx'):
                path = os.path.join(root, file)
                with open(path, 'r', encoding='utf-8') as f:
                    lines = f.readlines()
                    for i, line in enumerate(lines):
                        if pattern.search(line):
                            print(f"{path}:{i+1}: {line.strip()}")

if __name__ == "__main__":
    find_unescaped_entities('.')
