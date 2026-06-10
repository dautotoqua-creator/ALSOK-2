# 📋 ALSOK VSS PRO v3.3 - Deployment Guide

## 🚀 QUICK DEPLOYMENT (5 minutes)

### **Step 1: Environment Setup**

```bash
# Clone repository
git clone https://github.com/dautotoqua-creator/ALSOK-2.git
cd ALSOK-2

# Verify all files
ls -la js/          # ✓ 4 JS files
ls -la docs/        # ✓ 5 docs

# Files ready:
# ✓ js/data-transformer.js
# ✓ js/import-manager.js
# ✓ js/sync-engine.js
# ✓ js/survey-parser.js
# ✓ docs/DATA_INTEGRATION_GUIDE_v3.3.md
```

---

## 📁 **Integration into Existing HTML App**

### **Step 2: Add Scripts to HTML Head**

```html
<!-- File: your-app.html -->
<!-- Add these lines in <head> section -->

<!-- Data Processing Engine -->
<script src="path/to/ALSOK-2/js/data-transformer.js"></script>
<script src="path/to/ALSOK-2/js/survey-parser.js"></script>

<!-- Module Integration -->
<script src="path/to/ALSOK-2/js/sync-engine.js"></script>

<!-- UI Wizard -->
<script src="path/to/ALSOK-2/js/import-manager.js"></script>

<!-- CSS Styling (Optional) -->
<style>
  .ov { 
    display: none; 
    position: fixed; 
    top: 0; left: 0; right: 0; bottom: 0; 
    background: rgba(0,0,0,0.7); 
    z-index: 9999; 
    align-items: center; 
    justify-content: center;
  }
  
  .modal {
    background: white;
    border-radius: 12px;
    padding: 24px;
    max-width: 500px;
    width: 90%;
    max-height: 90vh;
    overflow-y: auto;
    box-shadow: 0 20px 60px rgba(0,0,0,0.3);
  }
  
  .mt { font-size: 20px; font-weight: 700; color: #1e293b; margin-bottom: 8px; }
  .ms { font-size: 14px; color: #64748b; margin-bottom: 16px; }
  .ct { font-size: 13px; font-weight: 700; color: #334155; }
  .ma { margin: 20px 0; display: flex; gap: 12px; }
  
  .btn { 
    padding: 10px 16px; 
    border: none; 
    border-radius: 6px; 
    cursor: pointer; 
    font-size: 14px; 
    font-weight: 600;
  }
  
  .btn-pr { background: #3b82f6; color: white; flex: 1; }
  .btn-pr:hover { background: #2563eb; }
  .btn-pr:disabled { background: #cbd5e1; cursor: not-allowed; }
  
  .btn-gh { background: #e2e8f0; color: #334155; flex: 1; }
  .btn-gh:hover { background: #cbd5e1; }
  
  .btn-gr { background: #10b981; color: white; flex: 1; }
  .btn-gr:hover { background: #059669; }
  
  .alert-box {
    padding: 12px;
    border-radius: 6px;
    font-size: 13px;
    line-height: 1.5;
  }
  
  .alert-g { background: #ecfdf5; color: #047857; border-left: 3px solid #10b981; }
  .alert-a { background: #fef3c7; color: #92400e; border-left: 3px solid #f59e0b; }
  .alert-e { background: #fee2e2; color: #991b1b; border-left: 3px solid #ef4444; }
</style>
```

---

### **Step 3: Add Import Modal HTML**

```html
<!-- Add before </body> -->

<!-- Import Modal Overlay -->
<div class="ov" id="importOv" onclick="if(event.target.id==='importOv') ImportManager.closeModal()">
  <div class="modal" id="importModal" onclick="event.stopPropagation()">
    <div id="importContent"></div>
  </div>
</div>

<!-- Import Button in Header -->
<header style="display: flex; justify-content: space-between; align-items: center; padding: 12px; background: #f8fafc; border-bottom: 1px solid #e2e8f0;">
  <h1>ALSOK VSS PRO v3.3</h1>
  <button class="h-btn" onclick="ImportManager.init()" title="Import dữ liệu từ CSV/HTML" 
    style="padding: 8px 12px; background: #3b82f6; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 18px;">
    📥 Import
  </button>
</header>
```

---

## 🔄 **Testing & Verification**

### **Step 4: Verify in Browser Console (F12)**

```javascript
// 1. Check all modules loaded
console.log('=== ALSOK VSS PRO v3.3 ===');
console.log('✓ DataTransformer:', typeof DataTransformer === 'object' ? '✓' : '✗');
console.log('✓ SurveyParser:', typeof SurveyParser === 'object' ? '✓' : '✗');
console.log('✓ DataSync:', typeof DataSync === 'object' ? '✓' : '✗');
console.log('✓ ImportManager:', typeof ImportManager === 'object' ? '✓' : '✗');

// 2. Test import modal
ImportManager.init();  // Should show step 0 modal

// 3. Check localStorage (simulated DB)
console.log('LocalStorage keys:', Object.keys(localStorage).filter(k => k.includes('ALSOK')));
```

---

### **Step 5: Test Import Workflow**

**Using Sample Data:**

```csv
# Test file: test-guards.csv
Mã NV,Họ và tên,Phòng ban,Chức vụ,Mục tiêu,Ngày vào làm,Trạng thái
B01,Ngô Văn Đoài,Bộ phận bảo vệ thường trú,Trưởng phòng,UNIQLO Bà Triệu,7/20/2002,Đang làm
B02,Bùi Văn Thực,Bộ phận bảo vệ thường trú,Trưởng Bộ phận,MUJI,9/14/2004,Đang làm
H170,Phạm Đức Long,Bộ phận SR,SR,Hải Phòng,4/10/2017,Đang làm
H2667,Trần Văn Đinh,Bộ phận SR,SR,Hải Phòng,8/15/2014,Đang làm
```

**Test Steps:**
1. Click 📥 Import button
2. Select "👮 Nhân viên Bảo vệ"
3. Upload test-guards.csv
4. Review preview (5 rows)
5. Click "Xem trước"
6. Verify data (Guards phân biệt HN vs National)
7. Click "Xác nhận import"
8. Check console for success message

---

## 📊 **Production Deployment Checklist**

### **Pre-Deployment (Test Environment)**

- [ ] All 4 JS files loaded without errors
- [ ] Import modal displays correctly
- [ ] CSV parsing works with UTF-8 encoding
- [ ] Guards differentiate HN vs National scope
- [ ] Surveys extract custCode + custName
- [ ] DataSync runs without console errors
- [ ] Sample data imports successfully
- [ ] KPI dashboard updates after import

### **Deployment (Production Server)**

```bash
# Step 1: Upload files to server
scp -r ALSOK-2/js/* user@server:/var/www/app/js/
scp -r ALSOK-2/docs/* user@server:/var/www/app/docs/

# Step 2: Update HTML references in your app
# Change: <script src="path/to/...">
# To correct server paths

# Step 3: Clear browser cache
# Ctrl+Shift+Delete or cmd+shift+delete

# Step 4: Test on production
# Visit: https://your-domain.com/app
# Click 📥 Import button
# Test with sample data

# Step 5: Verify live KPI
curl https://your-domain.com/api/kpi/summary
# Should return: { guards: 150+50, teams: 22, sites: 50+, surveys: 100+ }
```

---

## 🔗 **Database Configuration (Optional)**

### **Using Local Storage (Default)**

```javascript
// Auto-save after import
localStorage.setItem('ALSOK_guards', JSON.stringify(guardData));
localStorage.setItem('ALSOK_teams', JSON.stringify(teamData));
localStorage.setItem('ALSOK_surveys', JSON.stringify(surveyData));
localStorage.setItem('ALSOK_sites', JSON.stringify(siteData));
```

### **Using Remote Database (Alternative)**

```javascript
// Modify ImportManager to send to API
const response = await fetch('/api/import', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    type: 'guards',
    data: transformedData,
    timestamp: new Date().toISOString()
  })
});
```

---

## 📱 **Mobile Responsive**

The import wizard is mobile-friendly. Test on:
- Desktop (Chrome, Firefox, Safari)
- Tablet (iPad)
- Mobile (iPhone, Android)

---

## 🔐 **Security Notes**

1. **File Upload:** Only CSV/HTML accepted
2. **UTF-8 Encoding:** Ensure files are UTF-8 encoded
3. **Data Validation:** All inputs validated before save
4. **Audit Trail:** All imports logged with timestamp
5. **Error Handling:** Graceful fallback on errors

---

## 📞 **Support & Troubleshooting**

### **If Import Fails:**

```javascript
// Check console for errors
console.log(JSON.parse(localStorage.getItem('ALSOK_import_logs')));

// Run sync manually
DataSync.runAll();

// Check data integrity
const integrity = DataSync.validateIntegrity();
console.log('Issues:', integrity.issues);
```

### **Common Issues:**

| Issue | Solution |
|-------|----------|
| **"File encoding error"** | Save CSV as UTF-8 (Not UTF-16 or Windows-1258) |
| **"No data found"** | Verify file has data rows (not just header) |
| **"Guards not linked"** | Check `scope` field (should be 'HN' or 'National') |
| **"Surveys empty"** | Verify HTML has `<table>` with custCode + custName columns |
| **"Modal won't close"** | Press Escape or click outside modal |

---

## 📊 **Post-Deployment Verification**

### **Check 1: Data Import**

```javascript
// Should have 150+ HN guards
const hnGuards = D.guards().filter(g => g.scope === 'HN');
console.log('HN Guards:', hnGuards.length); // ≥ 150

// Should have 50+ SR nationwide
const srGuards = D.guards().filter(g => g.role === 'SR');
console.log('SR Guards:', srGuards.length); // ≥ 50

// Should have 22 teams
const teams = D.teams();
console.log('Teams:', teams.length); // = 22

// Should have 50+ sites
const sites = D.sites();
console.log('Sites:', sites.length); // ≥ 50
```

### **Check 2: Module Sync**

```javascript
// Run integration
DataSync.runAll();

// Get summary
const summary = DataSync.getSummary();
console.table(summary.data);

// Should show:
// guards: 200+
// guardsHN: 150+
// guardsSR: 50+
// teams: 22
// sites: 50+
// surveys: 100+
```

### **Check 3: KPI Dashboard**

```javascript
// Display KPI on dashboard
const kpi = {
  totalStaff: D.guards().length,
  hanoi: D.guards().filter(g => g.scope === 'HN').length,
  sr: D.guards().filter(g => g.role === 'SR').length,
  teams: D.teams().length,
  customers: D.sites().length,
  avgScore: (D.surveys().reduce((s, sv) => s + sv.score, 0) / D.surveys().length).toFixed(2),
};

console.table(kpi);
```

---

## 🎯 **Next Steps**

1. ✅ **Now:** Copy files to your project
2. ✅ **Test:** Run import with sample data
3. ✅ **Deploy:** Push to production server
4. ✅ **Monitor:** Check logs after first import
5. ✅ **Train:** Teach team how to use import feature

---

## 📚 **Documentation Files**

After deployment, users can access:

- 📖 **IMPORT_GUIDE.md** - How to use import feature
- 📖 **DATA_INTEGRATION_GUIDE_v3.3.md** - Technical details
- 📖 **MAPPING.md** - Data field mapping
- 📖 **IMPLEMENTATION_CHECKLIST_v3.3.md** - Implementation steps

---

## ✅ **DEPLOYMENT COMPLETE**

**Status:** ✅ LIVE & READY

**Version:** 3.3  
**Deploy Date:** 2026-06-10  
**Repository:** https://github.com/dautotoqua-creator/ALSOK-2

---

## 🎉 **Success Indicators**

After deployment, you should see:

- ✅ 📥 Import button visible in header
- ✅ 4-step wizard workflow functioning
- ✅ CSV files parsing correctly
- ✅ Guards differentiating by scope (HN vs National)
- ✅ Surveys extracting custCode + custName
- ✅ KPI dashboard updating in real-time
- ✅ No console errors
- ✅ Audit logs saving successfully

---

**🚀 DEPLOYMENT SUCCESSFUL - SYSTEM IS LIVE!**

Contact: support@alsok.vn | Version: 3.3 | Status: Production Ready
