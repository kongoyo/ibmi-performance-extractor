# -*- coding: utf-8 -*-
import sys
import re

with open('scripts/reporting/templates.py', 'r', encoding='utf-8') as f:
    content = f.read()

# Extract html_template
html_match = re.search(r'html_template = """(.*?)"""', content, re.DOTALL)
if html_match:
    html_content = html_match.group(1)
    
    # Extract CSS
    css_match = re.search(r'<style>(.*?)</style>', html_content, re.DOTALL)
    if css_match:
        css_content = css_match.group(1)
        css_content = css_content.replace('{{', '{').replace('}}', '}')
        with open('scripts/reporting/assets/style.css', 'w', encoding='utf-8') as f:
            f.write(css_content.strip())
        print('Wrote style.css')
        html_content = html_content.replace(f'<style>{css_match.group(1)}</style>', '<style>\n${css_content}\n</style>')
        
    # Extract JS
    js_match = re.search(r'<script>(.*?)</script>', html_content, re.DOTALL)
    if js_match:
        js_content = js_match.group(1)
        # Fix the unescaped {{...}} blocks back to {...}
        js_content = js_content.replace('{{', '{').replace('}}', '}')
        with open('scripts/reporting/assets/app.js', 'w', encoding='utf-8') as f:
            f.write(js_content.strip())
        print('Wrote app.js')
        html_content = html_content.replace(f'<script>{js_match.group(1)}</script>', '<script>\n${js_content}\n</script>')
        
    # Now we need to convert {var} to ${var} for string.Template in the html_content
    variables = ['host', 'lib', 'date_range', 'warnings_banner', 'cards_html', 'rca_section', 'times_js', 'dates_js', 'raw_data_js', 'peak_jobs_js', 'metrics_config_js']
    for var in variables:
        html_content = html_content.replace(f'{{{var}}}', f'${var}')
        
    with open('scripts/reporting/assets/template.html', 'w', encoding='utf-8') as f:
        f.write(html_content.strip())
    print('Wrote template.html')
else:
    print('Could not find html_template')
