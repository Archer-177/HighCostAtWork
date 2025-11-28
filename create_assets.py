from PIL import Image, ImageDraw, ImageFont
import os

# --- 1. GENERATE ICON (app.ico) ---
def create_icon():
    print("Generating app.ico...")
    size = (256, 256)
    # Medical Blue background
    img = Image.new('RGBA', size, color="#2563EB") 
    draw = ImageDraw.Draw(img)
    
    # White Cross
    thickness = 60
    center = size[0] // 2
    # Vertical
    draw.rectangle([center - thickness//2, 40, center + thickness//2, size[1] - 40], fill="white")
    # Horizontal
    draw.rectangle([40, center - thickness//2, size[0] - 40, center + thickness//2], fill="white")
    
    img.save('app.ico', format='ICO', sizes=[(256, 256)])

# --- 2. GENERATE SPLASH SCREEN (splash.png) ---
def create_splash():
    print("Generating splash.png...")
    width, height = 600, 400
    # Clean White/Blue Theme
    img = Image.new('RGB', (width, height), color="#FAF5F0") # Sand color
    draw = ImageDraw.Draw(img)
    
    # Header Bar
    draw.rectangle([0, 0, width, 10], fill="#8A2A2B") # Maroon
    
    # Text Placeholder box
    draw.rectangle([200, 180, 400, 220], outline="#8A2A2B", width=3)
    
    # Loading Bar Container
    draw.rectangle([100, 300, 500, 320], outline="#D97B5A", width=2)
    # Fill
    draw.rectangle([102, 302, 300, 318], fill="#D97B5A")

    img.save('splash.png')

# --- 3. GENERATE METADATA (version_info.txt) ---
def create_version_info():
    print("Generating version_info.txt...")
    content = """
VSVersionInfo(
  ffi=FixedFileInfo(
    filevers=(1, 0, 0, 0),
    prodvers=(1, 0, 0, 0),
    mask=0x3f,
    flags=0x0,
    OS=0x40004,
    fileType=0x1,
    subtype=0x0,
    date=(0, 0)
  ),
  kids=[
    StringFileInfo(
      [
      StringTable(
        u'040904B0',
        [StringStruct(u'CompanyName', u'FUNLHN Internal Tools'),
        StringStruct(u'FileDescription', u'High Cost Medicines Tracker'),
        StringStruct(u'FileVersion', u'1.0.0'),
        StringStruct(u'InternalName', u'FUNLHN_Meds'),
        StringStruct(u'LegalCopyright', u'Internal Use Only'),
        StringStruct(u'OriginalFilename', u'FUNLHN_Medicine_Tracker.exe'),
        StringStruct(u'ProductName', u'Medicine Tracker'),
        StringStruct(u'ProductVersion', u'1.0.0')])
      ]
    ),
    VarFileInfo([VarStruct(u'Translation', [1033, 1200])])
  ]
)
    """
    with open("version_info.txt", "w", encoding="utf-8") as f:
        f.write(content.strip())

if __name__ == "__main__":
    create_icon()
    create_splash()
    create_version_info()
    print("ALL ASSETS CREATED SUCCESSFULLY.")