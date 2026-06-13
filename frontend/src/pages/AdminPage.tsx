import React, { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import './AdminPage.css';

const AdminPage = () => {
  const { user } = useAuth();

  /* =========================
     UI STATE
  ========================= */
  const [activeTab, setActiveTab] = useState('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [status, setStatus] = useState({ message: '', type: '' });

  /* =========================
     PACKAGE STATE
  ========================= */
  const [packages, setPackages] = useState([]);
  const [showPackageModal, setShowPackageModal] = useState(false);
  const [editingPackage, setEditingPackage] = useState(null);
  const [regionalLinks, setRegionalLinks] = useState([]);

  const [packageForm, setPackageForm] = useState({
    name: '',
    price_usd: '',
    credits: 10,
    description: '',
    stripe_payment_link: '',
    lemonsqueezy_link: '',
    paddle_product_id: '',
    regional_payment_links: {},
    badge: '',
    is_active: true
  });

  /* =========================
     TEMPLATE STATE
  ========================= */
  const [templates, setTemplates] = useState([]);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState(null);

  const [templateForm, setTemplateForm] = useState({
    id: '',
    name: '',
    category: 'professional',
    is_premium: false,
    html_content: '',
    css_styles: ''
  });

  /* =========================
     UTILITIES
  ========================= */
  const showStatus = (message, type) => {
    setStatus({ message, type });
    setTimeout(() => setStatus({ message: '', type: '' }), 5000);
  };

  const getBadgeClass = (badge) => {
    if (!badge) return 'badge-default';
    const b = badge.toLowerCase();
    if (b.includes('popular')) return 'badge-popular';
    if (b.includes('hot')) return 'badge-hot';
    if (b.includes('new')) return 'badge-new';
    return 'badge-default';
  };

  /* =========================
     API — PACKAGES
  ========================= */
  const loadPackages = useCallback(async () => {
    try {
      const res = await api.get('/admin/packages');
      setPackages(res.data);
    } catch (error) {
      showStatus('Failed to load packages', 'error');
      console.error(error);
    }
  }, []);

  const savePackage = async (e) => {
    e.preventDefault();

    const regionalObj = {};
    regionalLinks.forEach((r) => {
      regionalObj[r.code] = {
        name: r.name,
        link: r.link,
        instructions: r.instructions
      };
    });

    try {
      const payload = {
        ...packageForm,
        regional_payment_links: JSON.stringify(regionalObj)
      };

      if (editingPackage) {
        await api.put(`/admin/packages/${editingPackage.id}`, payload);
        showStatus('✅ Package updated', 'success');
      } else {
        await api.post('/admin/packages', payload);
        showStatus('✅ Package created', 'success');
      }

      setShowPackageModal(false);
      resetPackageForm();
      loadPackages();
    } catch (err) {
      showStatus(err.message || 'Error saving package', 'error');
    }
  };

  const resetPackageForm = () => {
    setPackageForm({
      name: '',
      price_usd: '',
      credits: 10,
      description: '',
      stripe_payment_link: '',
      lemonsqueezy_link: '',
      paddle_product_id: '',
      regional_payment_links: {},
      badge: '',
      is_active: true
    });
    setRegionalLinks([]);
    setEditingPackage(null);
  };

  const openEditPackage = (pkg) => {
    setEditingPackage(pkg);
    setPackageForm(pkg);

    if (pkg.regional_payment_links) {
      try {
        const parsed = JSON.parse(pkg.regional_payment_links);
        setRegionalLinks(
          Object.entries(parsed).map(([code, data]) => ({
            code,
            ...data
          }))
        );
      } catch {
        setRegionalLinks([]);
      }
    }
    setShowPackageModal(true);
  };

  const deletePackage = async (id) => {
    if (!confirm('Delete this package?')) return;
    try {
      await api.delete(`/admin/packages/${id}`);
      showStatus('✅ Package deleted', 'success');
      loadPackages();
    } catch (err) {
      showStatus('Failed to delete package', 'error');
    }
  };

  const removeRegionalLink = (idx) => {
    setRegionalLinks(regionalLinks.filter((_, i) => i !== idx));
  };

  /* =========================
     API — TEMPLATES
  ========================= */
  const loadTemplates = useCallback(async () => {
    try {
      const res = await api.get('/templates');
      setTemplates(res.data);
    } catch (error) {
      showStatus('Failed to load templates', 'error');
      console.error(error);
    }
  }, []);

  const saveTemplate = async (e) => {
    e.preventDefault();
    try {
      if (editingTemplate) {
        await api.put(`/admin/templates/${editingTemplate.id}`, templateForm);
        showStatus('✅ Template updated', 'success');
      } else {
        await api.post('/admin/templates', templateForm);
        showStatus('✅ Template saved', 'success');
      }
      setShowTemplateModal(false);
      resetTemplateForm();
      loadTemplates();
    } catch (err) {
      showStatus(err.message || 'Template save failed', 'error');
    }
  };

  const resetTemplateForm = () => {
    setTemplateForm({
      id: '',
      name: '',
      category: 'professional',
      is_premium: false,
      html_content: '',
      css_styles: ''
    });
    setEditingTemplate(null);
  };

  const openEditTemplate = (tmpl) => {
    setEditingTemplate(tmpl);
    setTemplateForm({
      id: tmpl.id,
      name: tmpl.name,
      category: tmpl.category,
      is_premium: tmpl.is_premium,
      html_content: tmpl.html_content || '',
      css_styles: tmpl.css_styles || ''
    });
    setShowTemplateModal(true);
  };

  const deleteTemplate = async (id) => {
    if (!confirm('Delete this template?')) return;
    try {
      await api.delete(`/admin/templates/${id}`);
      showStatus('✅ Template deleted', 'success');
      loadTemplates();
    } catch (err) {
      showStatus('Failed to delete template', 'error');
    }
  };

  /* =========================
     EFFECTS
  ========================= */
  useEffect(() => {
    if (activeTab === 'packages') loadPackages();
    if (activeTab === 'templates') loadTemplates();
  }, [activeTab]);

  /* =========================
     AUTH GUARD
  ========================= */
  if (!user) {
    return (
      <div className="cms-container">
        <div className="cms-main center">
          <h1>🔒 Admin Access Required</h1>
          <button onClick={() => window.location.href = '/login'}>Go to Login</button>
        </div>
      </div>
    );
  }

  /* =========================
     RENDER TAB CONTENT
  ========================= */
  const renderTabContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return (
          <div>
            <h1>📊 Dashboard</h1>
            <div className="dashboard-stats">
              <div className="stat-card">
                <h3>Total Packages</h3>
                <p className="stat-number">{packages.length}</p>
              </div>
              <div className="stat-card">
                <h3>Total Templates</h3>
                <p className="stat-number">{templates.length}</p>
              </div>
              <div className="stat-card">
                <h3>Active Packages</h3>
                <p className="stat-number">
                  {packages.filter(p => p.is_active).length}
                </p>
              </div>
            </div>
          </div>
        );

      case 'packages':
        return (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h1>📦 Packages</h1>
              <button
                className="btn-primary"
                onClick={() => {
                  resetPackageForm();
                  setShowPackageModal(true);
                }}
              >
                ➕ New Package
              </button>
            </div>
            <div className="packages-list">
              {packages.length === 0 ? (
                <p>No packages found. Click "New Package" to create one.</p>
              ) : (
                packages.map((pkg) => (
                  <div key={pkg.id} className="package-card">
                    <h3>{pkg.name}</h3>
                    <p>${pkg.price_usd} - {pkg.credits} credits</p>
                    <p>{pkg.description}</p>
                    {pkg.badge && (
                      <span className={getBadgeClass(pkg.badge)}>{pkg.badge}</span>
                    )}
                    <div style={{marginTop: '15px', display: 'flex', gap: '10px'}}>
                      <button onClick={() => openEditPackage(pkg)}>Edit</button>
                      <button 
                        className="btn-danger" 
                        onClick={() => deletePackage(pkg.id)}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        );

      case 'templates':
        return (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h1>🎨 Templates</h1>
              <button
                className="btn-primary"
                onClick={() => {
                  resetTemplateForm();
                  setShowTemplateModal(true);
                }}
              >
                ➕ New Template
              </button>
            </div>
            <div className="templates-list">
              {templates.length === 0 ? (
                <p>No templates found.</p>
              ) : (
                templates.map((tmpl) => (
                  <div key={tmpl.id} className="template-card">
                    <h3>{tmpl.name}</h3>
                    <p>ID: {tmpl.id}</p>
                    <p>Category: {tmpl.category}</p>
                    <p>{tmpl.is_premium ? '⭐ Premium' : '🆓 Free'}</p>
                    <div style={{marginTop: '15px', display: 'flex', gap: '10px'}}>
                      <button onClick={() => openEditTemplate(tmpl)}>Edit</button>
                      <button 
                        className="btn-danger" 
                        onClick={() => deleteTemplate(tmpl.id)}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        );

      case 'settings':
        return (
          <div>
            <h1>⚙️ Settings</h1>
            <div style={{background: 'white', padding: '30px', borderRadius: '12px'}}>
              <p>Settings panel coming soon...</p>
              <p>Logged in as: <strong>{user.email}</strong></p>
            </div>
          </div>
        );

      default:
        return <div>Select a tab</div>;
    }
  };

  /* =========================
     MAIN RENDER
  ========================= */
  return (
    <div className="cms-container">
      <button
        className="cms-mobile-toggle"
        onClick={() => setSidebarOpen(!sidebarOpen)}
      >
        ☰
      </button>

      <div className={`cms-sidebar ${sidebarOpen ? 'mobile-open' : ''}`}>
        <h2>🛠️ Admin CMS</h2>
        <nav>
          {['dashboard', 'packages', 'templates', 'settings'].map((tab) => (
            <div
              key={tab}
              className={`cms-nav-item ${
                activeTab === tab ? 'active' : ''
              }`}
              onClick={() => {
                setActiveTab(tab);
                setSidebarOpen(false);
              }}
            >
              {tab}
              {tab === 'packages' && (
                <span className="pkg-count"> ({packages.length})</span>
              )}
            </div>
          ))}
        </nav>
        <div className="cms-sidebar-footer">Logged in as {user.email}</div>
      </div>

      <div className="cms-main">
        {status.message && (
          <div className={`status-message ${status.type}`}>
            {status.message}
          </div>
        )}
        
        {renderTabContent()}
      </div>

      {/* ================= PACKAGE MODAL ================= */}
      {showPackageModal && (
        <div
          className="modal-overlay"
          onClick={() => setShowPackageModal(false)}
        >
          <div
            className="modal-content"
            onClick={(e) => e.stopPropagation()}
          >
            <form onSubmit={savePackage}>
              <h2>
                {editingPackage ? '✏️ Edit Package' : '➕ Create Package'}
              </h2>

              <div>
                <label>Package Name *</label>
                <input
                  type="text"
                  required
                  value={packageForm.name}
                  onChange={(e) => setPackageForm({...packageForm, name: e.target.value})}
                  placeholder="e.g., Pro Career"
                />
              </div>

              <div>
                <label>Price (USD) *</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={packageForm.price_usd}
                  onChange={(e) => setPackageForm({...packageForm, price_usd: e.target.value})}
                  placeholder="e.g., 1500"
                />
              </div>

              <div>
                <label>Credits *</label>
                <input
                  type="number"
                  required
                  value={packageForm.credits}
                  onChange={(e) => setPackageForm({...packageForm, credits: parseInt(e.target.value)})}
                  placeholder="e.g., 10"
                />
              </div>

              <div>
                <label>Description</label>
                <textarea
                  value={packageForm.description}
                  onChange={(e) => setPackageForm({...packageForm, description: e.target.value})}
                  placeholder="Package description..."
                  rows="3"
                />
              </div>

              <div>
                <label>Badge</label>
                <input
                  type="text"
                  value={packageForm.badge}
                  onChange={(e) => setPackageForm({...packageForm, badge: e.target.value})}
                  placeholder="e.g., POPULAR, HOT, NEW"
                />
              </div>

              <div>
                <label>Stripe Payment Link</label>
                <input
                  type="url"
                  value={packageForm.stripe_payment_link}
                  onChange={(e) => setPackageForm({...packageForm, stripe_payment_link: e.target.value})}
                  placeholder="https://buy.stripe.com/..."
                />
              </div>

              <div>
                <label>LemonSqueezy Link</label>
                <input
                  type="url"
                  value={packageForm.lemonsqueezy_link}
                  onChange={(e) => setPackageForm({...packageForm, lemonsqueezy_link: e.target.value})}
                  placeholder="https://..."
                />
              </div>

              <div>
                <label>Paddle Product ID</label>
                <input
                  type="text"
                  value={packageForm.paddle_product_id}
                  onChange={(e) => setPackageForm({...packageForm, paddle_product_id: e.target.value})}
                  placeholder="prod_xxx"
                />
              </div>

              <div>
                <label>
                  <input
                    type="checkbox"
                    checked={packageForm.is_active}
                    onChange={(e) => setPackageForm({...packageForm, is_active: e.target.checked})}
                  />
                  {' '}Active
                </label>
              </div>

              {regionalLinks.length > 0 && (
                <div style={{marginTop: '20px'}}>
                  <h3>Regional Links</h3>
                  {regionalLinks.map((region, idx) => (
                    <div
                      key={idx}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'flex-start',
                        padding: '10px',
                        background: '#f5f5f5',
                        borderRadius: '6px',
                        marginBottom: '10px'
                      }}
                    >
                      <div style={{ flex: 1 }}>
                        <strong>{region.code} - {region.name}</strong>
                        {region.link && <div>Link: {region.link}</div>}
                        {region.instructions && (
                          <div style={{ whiteSpace: 'pre-line', fontSize: '12px' }}>
                            {region.instructions}
                          </div>
                        )}
                      </div>
                      <button
                        type="button"
                        className="btn-danger"
                        onClick={() => removeRegionalLink(idx)}
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div className="modal-footer">
                <button
                  type="button"
                  onClick={() => setShowPackageModal(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  Save Package
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= TEMPLATE MODAL ================= */}
      {showTemplateModal && (
        <div
          className="modal-overlay"
          onClick={() => setShowTemplateModal(false)}
        >
          <div
            className="modal-content"
            onClick={(e) => e.stopPropagation()}
            style={{maxWidth: '800px'}}
          >
            <form onSubmit={saveTemplate}>
              <h2>
                {editingTemplate ? '✏️ Edit Template' : '➕ Create Template'}
              </h2>

              <div>
                <label>Template ID *</label>
                <input
                  type="text"
                  required
                  value={templateForm.id}
                  onChange={(e) => setTemplateForm({...templateForm, id: e.target.value})}
                  placeholder="e.g., modern_blue"
                  disabled={!!editingTemplate}
                />
                <small style={{color: '#666'}}>Unique identifier (cannot be changed after creation)</small>
              </div>

              <div>
                <label>Template Name *</label>
                <input
                  type="text"
                  required
                  value={templateForm.name}
                  onChange={(e) => setTemplateForm({...templateForm, name: e.target.value})}
                  placeholder="e.g., Modern Blue"
                />
              </div>

              <div>
                <label>Category *</label>
                <select
                  value={templateForm.category}
                  onChange={(e) => setTemplateForm({...templateForm, category: e.target.value})}
                >
                  <option value="professional">Professional</option>
                  <option value="creative">Creative</option>
                  <option value="simple">Simple</option>
                  <option value="modern">Modern</option>
                </select>
              </div>

              <div>
                <label>
                  <input
                    type="checkbox"
                    checked={templateForm.is_premium}
                    onChange={(e) => setTemplateForm({...templateForm, is_premium: e.target.checked})}
                  />
                  {' '}Premium Template
                </label>
              </div>

              <div>
                <label>HTML Content *</label>
                <textarea
                  required
                  value={templateForm.html_content}
                  onChange={(e) => setTemplateForm({...templateForm, html_content: e.target.value})}
                  placeholder="<div>Your template HTML here...</div>"
                  rows="10"
                  style={{fontFamily: 'monospace', fontSize: '13px'}}
                />
              </div>

              <div>
                <label>CSS Styles</label>
                <textarea
                  value={templateForm.css_styles}
                  onChange={(e) => setTemplateForm({...templateForm, css_styles: e.target.value})}
                  placeholder=".template { ... }"
                  rows="10"
                  style={{fontFamily: 'monospace', fontSize: '13px'}}
                />
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  onClick={() => setShowTemplateModal(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  Save Template
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminPage;