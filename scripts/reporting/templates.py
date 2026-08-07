import os

# Base directory for the assets
ASSETS_DIR = os.path.join(os.path.dirname(__file__), 'assets')

def read_asset(filename):
    """Utility function to read a static asset file."""
    with open(os.path.join(ASSETS_DIR, filename), 'r', encoding='utf-8') as f:
        return f.read()

def get_html_template():
    return read_asset('template.html')

def get_css_asset():
    return read_asset('style.css')

def get_js_asset():
    return read_asset('app.js')

def get_rca_section():
    return read_asset('rca_section.html')
