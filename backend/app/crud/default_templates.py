# --- FIXED default_templates.py ---
# All Mustache color variables now have proper # prefix in CSS

default_templates_list = [
    {
        "id": "modern",
        "name": "Modern",
        "category": "creative",
        "is_premium": True,
        "html_content": """
        <div class="cv-modern">
            <aside class="cv-sidebar">
                <div class="profile-image-container">
                    <div class="profile-placeholder">
                        <div class="placeholder-avatar">
                            <span>{{full_name_initials}}</span>
                        </div>
                    </div>
                </div>
                
                <div class="sidebar-header">
                    <h1>{{full_name}}</h1>
                    <p class="job-title">{{job_title}}</p>
                </div>

                <div class="contact-info">
                    <div class="contact-item">
                        <span class="contact-text">{{email}}</span>
                    </div>
                    <div class="contact-item">
                        <span class="contact-text">{{phone}}</span>
                    </div>
                    <div class="contact-item">
                        <span class="contact-text">{{location}}</span>
                    </div>
                </div>

                <div class="sidebar-section">
                    <h3>Skills</h3>
                    <div class="skills-container">
                        {{#skills}}
                        <span class="skill-tag">{{.}}</span>
                        {{/skills}}
                    </div>
                </div>
            </aside>

            <main class="cv-main">
                <section class="cv-section">
                    <h2>Professional Summary</h2>
                    <div class="section-content">
                        {{{summary}}}
                    </div>
                </section>

                <section class="cv-section">
                    <h2>Experience</h2>
                    <div class="experience-list">
                        {{{experience}}}
                    </div>
                </section>

                <section class="cv-section">
                    <h2>Education</h2>
                    <div class="education-list">
                        {{{education}}}
                    </div>
                </section>
            </main>
        </div>
        """,
        'css_styles': """
            /* SCOPING: All styles are strictly inside .cv-modern */
            .cv-modern { 
                font-family: {{font_family}}, 'Inter', sans-serif; 
                display: flex;
                min-height: 100vh;
                margin: 0;
                background: white;
                width: 100%;
            }

            /* --- LEFT SIDE (SIDEBAR) --- */
            .cv-modern .cv-sidebar {
                width: 300px;
                background: linear-gradient(135deg, #{{accent_color}} 0%, rgb(44,62,80) 100%);
                color: #ffffff !important; 
                padding: 40px 30px;
                text-align: center;
                flex-shrink: 0;
            }

            .cv-modern .sidebar-header h1 {
                font-size: 2em;
                margin: 15px 0 10px 0;
                font-weight: 700;
                color: #ffffff !important; 
                line-height: 1.2;
            }

            .cv-modern .job-title {
                font-size: 1.1em;
                margin-bottom: 30px;
                color: rgba(255, 255, 255, 0.9) !important;
                font-weight: 300;
            }

            .cv-modern .contact-item {
                margin-bottom: 10px;
                color: rgba(255, 255, 255, 0.95) !important;
                font-size: 0.9em;
                display: block;
            }

            .cv-modern .sidebar-section h3 {
                color: #ffffff !important;
                border-bottom: 1px solid rgba(255,255,255,0.3);
                padding-bottom: 10px;
                margin-top: 30px;
            }

            .cv-modern .skill-tag {
                background: rgba(255,255,255,0.2);
                color: #ffffff !important;
                padding: 5px 10px;
                border-radius: 15px;
                font-size: 0.85em;
                display: inline-block;
                margin: 3px;
            }

            /* --- RIGHT SIDE (MAIN CONTENT) --- */
            .cv-modern .cv-main {
                flex: 1;
                padding: 40px;
                background: white;
                color: #{{text_color}}; 
            }

            .cv-modern .cv-section h2 {
                color: #{{accent_color}};
                font-size: 1.5em;
                margin-bottom: 20px;
                text-transform: uppercase;
                letter-spacing: 1px;
                border-bottom: 2px solid #eee;
                padding-bottom: 10px;
            }

            .cv-modern .section-content, 
            .cv-modern .experience-list li, 
            .cv-modern .education-list li {
                color: #{{text_color}};
                line-height: 1.6;
            }

            .cv-modern .experience-list ul, 
            .cv-modern .education-list ul {
                padding-left: 20px;
            }
            
            @media (max-width: 768px) {
                .cv-modern { flex-direction: column; }
                .cv-modern .cv-sidebar { width: 100%; }
            }
        """
    },
    {
        'id': 'classic',
        'name': 'Classic',
        'category': 'traditional',
        'is_premium': False,
        'html_content': """
        <div class="cv-classic">
            <header class="cv-header">
                <h1>{{full_name}}</h1>
                <p class="job-title">{{job_title}}</p>
                <p class="contact-info">{{email}} | {{phone}}</p>
            </header>
            <section class="cv-section">
                <h2>Objective</h2>
                {{{summary}}}
            </section>
            <section class="cv-section">
                <h2>Professional Experience</h2>
                {{{experience}}}
            </section>
            <section class="cv-section">
                <h2>Education</h2>
                {{{education}}}
            </section>
            <section class="cv-section">
                <h2>Core Competencies</h2>
                 <ul class="skills-list">
                    {{#skills}}
                        <li>{{.}}</li>
                    {{/skills}}
                </ul>
            </section>
        </div>
        """,
        'css_styles': """
        .cv-classic { font-family: {{font_family}}, 'Times New Roman', serif; color: #{{text_color}}; line-height: 1.4; padding: 40px; max-width: 800px; margin: 0 auto; }
        .cv-classic .cv-header { text-align: center; margin-bottom: 25px; border-bottom: 2px solid #{{text_color}}; padding-bottom: 15px; }
        .cv-classic .cv-header h1 { font-size: 2.2em; margin-bottom: 8px; color: #{{text_color}}; text-transform: uppercase; }
        .cv-classic .job-title { color: #{{text_color}}; font-style: italic; font-size: 1.2em;}
        .cv-classic .contact-info { color: #{{text_color}}; margin-top: 5px; }
        .cv-classic .cv-section { margin-bottom: 20px; }
        .cv-classic .cv-section h2 { font-size: 1.1em; text-transform: uppercase; margin-bottom: 10px; border-bottom: 1px solid #{{text_color}}; padding-bottom: 5px; color: #{{text_color}};}
        .cv-classic .cv-section ul { padding-left: 20px; margin: 0; }
        .cv-classic .skills-list { list-style-type: disc; columns: 2; }
        """
    },
    {
        "id": "minimalist",
        "name": "Minimalist",
        "category": "modern",
        "is_premium": False,
        "html_content": """
        <div class="cv-minimalist">
            <header class="cv-header">
                <div class="profile-info">
                    <h1>{{full_name}}</h1>
                    <p class="job-title">{{job_title}}</p>
                </div>
                <div class="contact-info">
                    <span class="contact-item">{{email}}</span>
                    <span class="contact-separator">•</span>
                    <span class="contact-item">{{phone}}</span>
                </div>
            </header>
            
            <section class="cv-section">
                <h2>Summary</h2>
                <div class="section-content">
                    {{{summary}}}
                </div>
            </section>
            
            <section class="cv-section">
                <h2>Experience</h2>
                <div class="section-content">
                    <div class="experience-list">{{{experience}}}</div>
                </div>
            </section>
            
            <section class="cv-section">
                <h2>Education</h2>
                <div class="section-content">
                    <div class="education-list">{{{education}}}</div>
                </div>
            </section>
            
            <section class="cv-section">
                <h2>Skills</h2>
                <div class="section-content">
                    <div class="skills-grid">
                        {{#skills}}
                            <span class="skill-item">{{.}}</span>
                        {{/skills}}
                    </div>
                </div>
            </section>
        </div>
    """,
    "css_styles": """
        .cv-minimalist {
            font-family: {{font_family}}, 'Inter', 'Segoe UI', sans-serif;
            max-width: 800px;
            margin: 0 auto;
            padding: 60px 40px;
            background: white;
            color: #{{text_color}};
            line-height: 1.6;
        }
        
        .cv-minimalist .cv-header {
            margin-bottom: 50px;
            border-bottom: 1px solid #e2e8f0;
            padding-bottom: 30px;
        }
        
        .cv-minimalist .profile-info h1 {
            font-size: 2.5em;
            font-weight: 300;
            margin: 0 0 5px 0;
            color: #{{text_color}};
            letter-spacing: -0.5px;
        }
        
        .cv-minimalist .profile-info .job-title {
            font-size: 1.1em;
            color: #718096;
            margin: 0;
            font-weight: 400;
        }
        
        .cv-minimalist .contact-info {
            display: flex;
            align-items: center;
            font-size: 0.95em;
            color: #{{text_color}};
            opacity: 0.8;
        }
        
        .cv-minimalist .cv-section h2 {
            font-size: 1.1em;
            font-weight: 600;
            color: #{{accent_color}};
            margin-bottom: 20px;
            text-transform: uppercase;
            letter-spacing: 1px;
            position: relative;
        }
        
        .cv-minimalist .cv-section h2::after {
            content: '';
            position: absolute;
            bottom: -8px;
            left: 0;
            width: 30px;
            height: 1px;
            background: #{{accent_color}};
        }
        
        .cv-minimalist .section-content {
            color: #{{text_color}};
        }
        
        .cv-minimalist .skills-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
            gap: 12px;
            margin-top: 10px;
        }
        
        .cv-minimalist .skill-item {
            padding: 8px 12px;
            background: #f7fafc;
            border: 1px solid #e2e8f0;
            border-radius: 4px;
            font-size: 0.9em;
            color: #{{text_color}};
            text-align: center;
        }
    """
}
]