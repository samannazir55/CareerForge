PERMANENT_TEMPLATES = [
    # --- FREE TIER ---
    {
        "id": "modern", 
        "name": "Modern Blue", 
        "category": "professional", 
        "is_premium": False,
        "html_content": """
        <div class='resume-modern'>
            <div class='sidebar'>
                <div class='profile-container'>
                    {{#profile_image}}<img src='{{profile_image}}' class='profile-img'/>{{/profile_image}}
                    <h1>{{full_name}}</h1>
                    <p class='job-title'>{{job_title}}</p>
                </div>
                
                <div class='contact-box'>
                    <div class='label'>Contact</div>
                    <div class='value'>{{email}}</div>
                    <div class='value'>{{phone}}</div>
                    {{#location}}<div class='value'>📍 {{location}}</div>{{/location}}
                </div>
                
                <div class='skills-box'>
                    <div class='label'>Skills</div>
                    <ul>{{#skills}}<li>{{.}}</li>{{/skills}}</ul>
                </div>
                
                {{#languages}}
                <div class='sidebar-section'>
                    <div class='label'>Languages</div>
                    <ul>{{#languages}}<li>{{.}}</li>{{/languages}}</ul>
                </div>
                {{/languages}}
                
                {{#hobbies}}
                <div class='sidebar-section'>
                    <div class='label'>Hobbies</div>
                    <ul>{{#hobbies}}<li>{{.}}</li>{{/hobbies}}</ul>
                </div>
                {{/hobbies}}
                
                {{#certifications}}
                <div class='sidebar-section'>
                    <div class='label'>Certifications</div>
                    <ul>{{#certifications}}<li>{{.}}</li>{{/certifications}}</ul>
                </div>
                {{/certifications}}
                
                <div class='social-links'>
                    {{#linkedin}}<div class='social-item'>🔗 LinkedIn</div>{{/linkedin}}
                    {{#github}}<div class='social-item'>💻 GitHub</div>{{/github}}
                    {{#portfolio}}<div class='social-item'>🌐 Portfolio</div>{{/portfolio}}
                </div>
            </div>
            
            <div class='main-content'>
                <div class='section'>
                    <h2>Profile</h2>
                    <div class='text'>{{{summary}}}</div>
                </div>
                <div class='section'>
                    <h2>Experience</h2>
                    <div class='text history-list'>{{{experience}}}</div>
                </div>
                <div class='section'>
                    <h2>Education</h2>
                    <div class='text history-list'>{{{education}}}</div>
                </div>
            </div>
        </div>
        """,
        "css_styles": """
        :root{--primary: #{{accent_color}}; --text: #{{text_color}}; --font: {{font_family}};}
        .resume-modern{display:flex;font-family:var(--font),sans-serif;min-height:1000px;background:white;color:var(--text)}
        .sidebar{width:35%;background:var(--primary);color:white;padding:30px 20px;text-align:center}
        .main-content{width:65%;padding:30px}
        .profile-img{width:120px;height:120px;border-radius:50%;border:4px solid rgba(255,255,255,0.3);object-fit:cover;margin-bottom:10px}
        h1{font-size:22px;margin:10px 0;text-transform:uppercase}
        h2{color:var(--primary);border-bottom:2px solid var(--primary);padding-bottom:5px;margin-top:0}
        .label{font-weight:bold;border-bottom:1px solid rgba(255,255,255,0.2);margin:20px 0 10px;text-transform:uppercase;font-size:12px}
        .text{font-size:14px;line-height:1.6;margin-bottom:20px}
        ul{padding:0;list-style:none;}
        li{background:rgba(0,0,0,0.1);margin:2px;padding:4px;border-radius:3px;font-size:12px;}
        .sidebar-section{margin-top:20px;}
        .social-links{margin-top:20px;font-size:11px;}
        .social-item{margin:5px 0;opacity:0.9;}
        """
    },
    {
        "id": "classic", 
        "name": "Classic Clean", 
        "category": "simple", 
        "is_premium": False,
        "html_content": """
        <div class='resume-classic'>
            <div class='header'>
                <h1>{{full_name}}</h1>
                <p>{{job_title}}</p>
                <p class='contact'>{{email}} | {{phone}}{{#location}} | {{location}}{{/location}}</p>
            </div>
            <hr/>
            
            <h3>Professional Summary</h3>
            <p class='summary'>{{{summary}}}</p>
            
            <h3>Core Competencies</h3>
            <div class='skills-grid'>{{#skills}}<span class='skill-item'>{{.}}</span>{{/skills}}</div>
            
            {{#languages}}
            <h3>Languages</h3>
            <div class='skills-grid'>{{#languages}}<span class='skill-item'>{{.}}</span>{{/languages}}</div>
            {{/languages}}
            
            <h3>Professional Experience</h3>
            <div class='content'>{{{experience}}}</div>
            
            <h3>Education</h3>
            <div class='content'>{{{education}}}</div>
            
            {{#hobbies}}
            <h3>Interests</h3>
            <div class='skills-grid'>{{#hobbies}}<span class='skill-item'>{{.}}</span>{{/hobbies}}</div>
            {{/hobbies}}
            
            {{#certifications}}
            <h3>Certifications</h3>
            <ul>{{#certifications}}<li>{{.}}</li>{{/certifications}}</ul>
            {{/certifications}}
        </div>
        """,
        "css_styles": """
        :root{--primary: #{{accent_color}}; --text: #{{text_color}};}
        .resume-classic{font-family:'Times New Roman',serif;padding:40px;background:white;color:var(--text);min-height:1000px}
        .header{text-align:center;margin-bottom:20px}
        h1{margin:0;font-size:28px;text-transform:uppercase;color:var(--primary)}
        .header p{margin:5px 0;font-style:italic}
        h3{background:#f0f0f0;padding:5px 10px;text-transform:uppercase;font-size:14px;font-weight:bold;border-left:5px solid var(--primary);margin-top:20px}
        .skills-grid{display:flex;flex-wrap:wrap;gap:10px;margin-bottom:20px}
        .skill-item{border:1px solid #333;padding:3px 8px;font-size:13px}
        ul{padding-left:20px}
        """
    },
    
    # --- PREMIUM TIER ---
    {
        "id": "startup_bold", 
        "name": "Startup Bold", 
        "category": "creative", 
        "is_premium": True,
        "html_content": """
        <div class='resume-start'>
            <div class='start-sidebar'>
                <h1>{{full_name}}</h1>
                <h3>{{job_title}}</h3>
                {{#profile_image}}<div class='start-img-container'><img src='{{profile_image}}'/></div>{{/profile_image}}
                
                <div class='start-group'>
                    <div class='start-label'>Contact</div>
                    <div>{{email}}</div>
                    <div>{{phone}}</div>
                    {{#location}}<div>📍 {{location}}</div>{{/location}}
                </div>
                
                <div class='start-group'>
                    <div class='start-label'>Skills</div>
                    <div class='tag-cloud'>{{#skills}}<span class='tag'>{{.}}</span>{{/skills}}</div>
                </div>
                
                {{#languages}}
                <div class='start-group'>
                    <div class='start-label'>Languages</div>
                    <div class='tag-cloud'>{{#languages}}<span class='tag'>{{.}}</span>{{/languages}}</div>
                </div>
                {{/languages}}
                
                {{#hobbies}}
                <div class='start-group'>
                    <div class='start-label'>Interests</div>
                    <div class='tag-cloud'>{{#hobbies}}<span class='tag'>{{.}}</span>{{/hobbies}}</div>
                </div>
                {{/hobbies}}
            </div>
            
            <div class='start-body'>
                <div class='blob'></div>
                <h2 class='shadow-head'>Manifesto</h2>
                <div class='content'>{{{summary}}}</div>
                <h2 class='shadow-head'>Experience</h2>
                <div class='content'>{{{experience}}}</div>
                <h2 class='shadow-head'>Education</h2>
                <div class='content'>{{{education}}}</div>
                {{#certifications}}
                <h2 class='shadow-head'>Certifications</h2>
                <ul>{{#certifications}}<li>{{.}}</li>{{/certifications}}</ul>
                {{/certifications}}
            </div>
        </div>
        """,
        "css_styles": """
        :root{--primary: #{{accent_color}};}
        .resume-start{display:flex;font-family:sans-serif;min-height:1000px;background:#fff;width:100%;overflow:hidden;position:relative}
        .start-sidebar{width:35%;background:#111;color:white;padding:40px 20px;text-align:center}
        .start-body{width:65%;padding:40px;position:relative}
        .start-img-container img{width:150px!important;height:150px!important;border-radius:50%;border:4px solid var(--primary);object-fit:cover;margin:0 auto 30px;display:block}
        .start-label{font-size:11px;text-transform:uppercase;color:#888;border-bottom:1px solid #333;margin-bottom:5px}
        .start-group{margin-bottom:20px;}
        .tag{display:inline-block;background:#333;padding:4px 8px;border-radius:4px;margin:2px;font-size:11px}
        .shadow-head{font-size:24px;color:#333;text-transform:uppercase;font-weight:800;border-left:5px solid var(--primary);padding-left:15px;margin:0 0 20px}
        .blob{position:absolute;top:-50px;right:-50px;width:200px;height:200px;background:var(--primary);border-radius:50%;opacity:0.1}
        """
    },
    {
        "id": "ivy_league", 
        "name": "Ivy League", 
        "category": "academic", 
        "is_premium": True,
        "html_content": """
        <div class='resume-ivy'>
            <div class='ivy-header'>
                <h1>{{full_name}}</h1>
                <div class='subtitle'>{{job_title}}</div>
                <div class='ivy-contact'>{{email}} • {{phone}}{{#location}} • {{location}}{{/location}}</div>
            </div>
            <div class='ivy-body'>
                {{#profile_image}}<div class='photo-c'><img src='{{profile_image}}'/></div>{{/profile_image}}
                
                <div class='stitle'>Professional Summary</div>
                <div class='content'>{{{summary}}}</div>
                
                <div class='stitle'>Experience</div>
                <div class='content'>{{{experience}}}</div>
                
                <div class='stitle'>Education</div>
                <div class='content'>{{{education}}}</div>
                
                <div class='stitle'>Skills</div>
                <div class='sgrid'>{{#skills}}<span>{{.}}</span>{{/skills}}</div>
                
                {{#languages}}
                <div class='stitle'>Languages</div>
                <div class='sgrid'>{{#languages}}<span>{{.}}</span>{{/languages}}</div>
                {{/languages}}
                
                {{#certifications}}
                <div class='stitle'>Certifications</div>
                <ul>{{#certifications}}<li>{{.}}</li>{{/certifications}}</ul>
                {{/certifications}}
                
                {{#hobbies}}
                <div class='stitle'>Interests</div>
                <div class='sgrid'>{{#hobbies}}<span>{{.}}</span>{{/hobbies}}</div>
                {{/hobbies}}
            </div>
        </div>
        """,
        "css_styles": """
        :root{--primary:#{{accent_color}}; --font:{{font_family}};}
        .resume-ivy{font-family:'Times New Roman',serif;padding:40px;background:white;min-height:1000px}
        .ivy-header{text-align:center;border-bottom:3px double #333;padding-bottom:20px;margin-bottom:20px}
        h1{font-size:32px;margin:0}
        .subtitle{color:var(--primary);font-style:italic;margin-top:5px}
        .stitle{text-transform:uppercase;border-bottom:1px solid #000;font-weight:bold;margin:20px 0 10px;color:var(--primary);letter-spacing:1px;font-size:14px}
        .photo-c{text-align:center;margin-bottom:15px}
        .photo-c img{width:100px;height:100px;object-fit:cover;border:1px solid #ddd}
        .sgrid{display:flex;flex-wrap:wrap;gap:8px;margin:10px 0;}
        .sgrid span{border:1px solid var(--primary);padding:4px 8px;font-size:12px;}
        """
    },
    {
        "id": "tech_minimal", 
        "name": "Tech Minimal", 
        "category": "technical", 
        "is_premium": True,
        "html_content": """
        <div class='resume-tech'>
            <div class='tech-main'>
                <h1>{{full_name}}</h1>
                <div class='role-tag'>{{job_title}}</div>
                
                <div class='t-sec'>
                    <div class='s-head'>> Summary</div>
                    <p>{{{summary}}}</p>
                </div>
                
                <div class='t-sec'>
                    <div class='s-head'>> Log</div>
                    <div class='code'>{{{experience}}}</div>
                </div>
                
                <div class='t-sec'>
                    <div class='s-head'>> Education</div>
                    <div class='code'>{{{education}}}</div>
                </div>
                
                {{#certifications}}
                <div class='t-sec'>
                    <div class='s-head'>> Certifications</div>
                    <ul>{{#certifications}}<li>{{.}}</li>{{/certifications}}</ul>
                </div>
                {{/certifications}}
            </div>
            
            <div class='tech-sidebar'>
                {{#profile_image}}<img src='{{profile_image}}'/>{{/profile_image}}
                
                <h4>Connect</h4>
                <p>{{email}}</p>
                <p>{{phone}}</p>
                {{#location}}<p>📍 {{location}}</p>{{/location}}
                
                {{#linkedin}}<p class='link'>🔗 LinkedIn</p>{{/linkedin}}
                {{#github}}<p class='link'>💻 GitHub</p>{{/github}}
                {{#portfolio}}<p class='link'>🌐 Portfolio</p>{{/portfolio}}
                
                <h4>Stack</h4>
                {{#skills}}<div class='t-skill'>{{.}}</div>{{/skills}}
                
                {{#languages}}
                <h4>Languages</h4>
                {{#languages}}<div class='t-skill'>{{.}}</div>{{/languages}}
                {{/languages}}
                
                {{#hobbies}}
                <h4>Interests</h4>
                {{#hobbies}}<div class='t-skill'>{{.}}</div>{{/hobbies}}
                {{/hobbies}}
            </div>
        </div>
        """,
        "css_styles": """
        :root{--primary:#{{accent_color}};}
        .resume-tech{display:flex;font-family:'Courier New',monospace;background:white;min-height:1000px;border-top:5px solid var(--primary)}
        .tech-main{flex:2;padding:40px}
        .tech-sidebar{flex:1;background:#f8f9fa;padding:30px;border-left:1px solid #ddd;text-align:center}
        .role-tag{background:var(--primary);color:white;display:inline-block;padding:2px 8px;font-size:12px;margin-bottom:30px}
        .s-head{color:var(--primary);font-weight:bold;margin-bottom:10px}
        .tech-sidebar img{width:120px;height:120px;border-radius:4px;object-fit:cover;margin-bottom:20px;filter:grayscale(100%)}
        .t-skill::before{content:'> ';color:var(--primary)}
        .link{font-size:11px;margin:3px 0;}
        h4{margin-top:20px;color:var(--primary);}
        """
    }
]