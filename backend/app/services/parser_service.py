
import io
import pypdf
import docx

def extract_text(file_bytes: bytes, filename: str) -> str:
    text_content = ""
    try:
        # Debug print
        print(f"📄 Processing file: {filename}")
        
        if filename.lower().endswith(".pdf"):
            reader = pypdf.PdfReader(io.BytesIO(file_bytes))
            text_content = "\n".join([page.extract_text() for page in reader.pages])
            
        elif filename.lower().endswith(".docx"):
            doc = docx.Document(io.BytesIO(file_bytes))
            text_content = "\n".join([p.text for p in doc.paragraphs])
            
        elif filename.lower().endswith(".txt"):
            text_content = file_bytes.decode("utf-8")
            
        print(f"✅ Extracted {len(text_content)} characters.")
        
    except Exception as e:
        print(f"❌ Parsing Error: {e}")
        return ""
        
    return text_content
