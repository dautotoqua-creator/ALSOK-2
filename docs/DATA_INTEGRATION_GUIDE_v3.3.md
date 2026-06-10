# 📊 DATA INTEGRATION GUIDE v3.3

## 🎯 Tổng quan Cập nhật

Phiên bản v3.3 chuẩn hóa toàn bộ dữ liệu với các tính năng:

- ✅ **Phân biệt phạm vi nhân viên**: Guards Hà Nội vs SR toàn quốc
- ✅ **Extract khách hàng từ khảo sát**: Mã KH + Tên KH
- ✅ **Tích hợp đồng bộ modules**: guards ↔ teams ↔ surveys ↔ sites
- ✅ **Chuẩn hóa vùng miền**: A01-A04 (Hà Nội, HCM, Hải Phòng, Đà Nẵng)
- ✅ **Auto-create references**: Tự động tạo site từ khách hàng

---

## 📋 DATA FLOW

```
Input Files (CSV/HTML)
    ↓
DataTransformer v3.3
    ├─ guards (150+ HN) + SR (National)
    ├─ teams (22 quốc gia)
    ├─ surveys (extract custCode + custName)
    └─ sites (auto-created)
    ↓
SurveyParser v3.3
    ├─ Parse HTML/CSV
    ├─ Extract Likert Q1-Q11
    ├─ Calculate weighted score
    └─ Generate risk level
    ↓
DataSync v3.3
    ├─ Link guards → teams
    ├─ Sync surveys → sites
    ├─ Update area metrics
    └─ Validate FK integrity
    ↓
ImportManager v3.3
    ├─ 4-step UI wizard
    ├─ Transform & validate
    ├─ Save to D (Database)
    └─ Log audit trail
```

---

## 🔄 PHÂN BIỆT NHÂN VIÊN (HN vs National)

### **Guards Hà Nội (HN)**

```javascript
{
  id: 'B01',
  name: 'Ngô Văn Đoài',
  role: 'Guard' || 'Leader',
  scope: 'HN',              // ← Chỉ Hà Nội
  areaId: 'A01',            // ← Hà Nội
  siteId: 'MT-01',          // ← UNIQLO
  dept: 'Bộ phận bảo vệ thường trú',
  status: 'online',
}
```

**Đặc điểm:**
- Công tác tại Hà Nội
- Bảo vệ cố định tại các mục tiêu
- Sĩ số: 150+ người
- Cơ sở: văn phòng Hà Nội

### **Guards SR/Phản ứng nhanh (National)**

```javascript
{
  id: 'H170',
  name: 'Phạm Đức Long',
  role: 'SR',
  scope: 'National',        // ← Toàn quốc
  areaId: 'A03',            // ← Hải Phòng (BASE)
  teamId: 'SR_HP_01',       // ← Đội SR
  dept: 'Bộ phận phản ứng nhanh',
  status: 'ready',
}
```

**Đặc điểm:**
- Phục vụ toàn quốc (14 bases)
- Đáp ứng nhanh khi có sự cố
- Sĩ số: 50+ người
- Cơ sở: 14 base khắp quốc gia

---

## 🗺️ VÙNG MIỀN CHUẨN HÓA

| areaId | Region | Code | City | Base |
|--------|--------|------|------|------|
| **A01** | Hà Nội | HN | Hà Nội, Vĩnh Phúc, Hưng Yên, Hà Nam, Ninh Bình | BASE-HN01, BASE-HP01-HP02 |
| **A02** | TP.HCM | HCM | TP.HCM, Biên Hòa, Cần Thơ | BASE-HCM01, BASE-HCM02 |
| **A03** | Hải Phòng | HP | Hải Phòng, Quảng Ninh | BASE-HP01, BASE-HP02 |
| **A04** | Đà Nẵng | DN | Đà Nẵng, Huế | BASE-DN |

### Mapping Logic:

```javascript
// Automatic region detection
'Hà Nội' → A01
'VĨNH PHÚC' → A01
'Hưng Yên' → A01
'TP.HCM' → A02
'Đà Nẵng' → A04
'Hải Phòng' → A03
```

---

## 👥 KHÁCH HÀNG TỪ KHẢO SÁT

File: `Dữ liệu khảo sát bảo vệ 2026.htm`

### **Extract từ HTML:**

```javascript
// Bảng khảo sát format:
<table>
  <tr>
    <th>Mã KH</th>
    <th>Tên KH</th>
    <th>Kỳ</th>
    <th>Q1</th>...<th>Q11</th>
    <th>Nhận xét</th>
  </tr>
  <tr>
    <td>UNIQLO-BT</td>
    <td>UNIQLO Bà Triệu</td>
    <td>Q2 2026</td>
    <td>4</td>...<td>4</td>
    <td>Tốt</td>
  </tr>
</table>

// Output:
{
  custCode: 'UNIQLO-BT',       // ← Mã khách hàng
  custName: 'UNIQLO Bà Triệu', // ← Tên khách hàng
  period: 'Q2 2026',
  answers: [4, 4, 4, 3, 4, 3, 4, 3, 4, 4, 3],
  score: 3.73,                 // ← Weighted average
  risk: 'good',
  siteId: 'MT-01',             // ← Auto-mapped
  comments: 'Tốt'
}
```

### **Tính điểm Likert:**

```
Q1-Q11: 1-5 stars
Weights: [1.2, 1.2, 1.1, 1.1, 1.0, 1.0, 1.0, 0.9, 0.9, 0.8, 0.8]
Formula: (Σ answer × weight) / Σ weight

Risk levels:
< 2.5 → Critical 🔴
2.5-3.5 → Medium 🟡
3.5-4.5 → Good 🟢
≥ 4.5 → Excellent ⭐
```

---

## 🔗 TÍCH HỢP MODULE

### **1. Guards ↔ Teams (Link SR)**

```javascript
// Before: SR guards không liên kết
guard: { id: 'H170', role: 'SR', areaId: 'A03' }
team: { id: 'SR_HP_01', areaId: 'A03' }

// After DataSync:
guard: { 
  id: 'H170', 
  role: 'SR', 
  areaId: 'A03',
  teamId: 'SR_HP_01'  // ← Auto-linked
}
```

### **2. Teams ↔ Areas (Normalize)**

```javascript
// Before: Area chưa được setting
team: { 
  id: 'SR_HN_01',
  name: 'Đội SR Hà Nội',
  areaId: null,
  sla: null
}

// After DataSync:
team: {
  id: 'SR_HN_01',
  name: 'Đội SR Hà Nội',
  areaId: 'A01',       // ← Auto-set
  region: 'Hà Nội',    // ← Normalized
  sla: 15              // ← Area-based SLA
}
```

### **3. Surveys ↔ Sites (Auto-create)**

```javascript
// Before: Sites chưa có
survey: { 
  custCode: 'UNIQLO-BT',
  custName: 'UNIQLO Bà Triệu',
  siteId: null
}

// After DataSync:
survey: { 
  custCode: 'UNIQLO-BT',
  custName: 'UNIQLO Bà Triệu',
  siteId: 'MT-01'      // ← Auto-created
}

site: {
  id: 'MT-01',
  name: 'UNIQLO Bà Triệu',
  code: 'UNIQLO-BT',
  type: 'Customer',
  status: 'active'
}
```

### **4. Company ↔ Area KPI (Update)**

```javascript
// Before: No metrics
company: {
  id: 'CO-01',
  name: 'ALSOK Northern',
  areaId: 'A01'
}

// After DataSync:
company: {
  id: 'CO-01',
  name: 'ALSOK Northern',
  areaId: 'A01',
  teamCount: 3,        // ← Count of teams
  sla: 15,             // ← Min SLA from teams
  guardCount: 120,     // ← Count of guards
  srCount: 15          // ← Count of SR
}
```

---

## 📥 IMPORT WORKFLOW

### **Step 1: Select Type**
```
👮 Nhân viên Bảo vệ
   → Guards (150 HN + SR National)
   
🚗 Đội SR (Base)
   → Teams (22 toàn quốc)
   
⭐ Khảo sát CL
   → Surveys + Customers (auto-extracted)
```

### **Step 2: Upload File**
```
Nhân sự CSV
├─ Mã NV, Họ và tên, Phòng ban, Chức vụ, Mục tiêu
├─ Auto-detect scope (HN vs National)
└─ Auto-map siteId

SR Base CSV
├─ TÊN BASE, Khu vực, ĐỊA CHỈ, Số lượng KH
├─ Auto-normalize region
└─ Auto-set SLA

Khảo sát HTML
├─ Extract Mã KH, Tên KH, Điểm
├─ Parse 11 Likert questions
└─ Auto-create customer sites
```

### **Step 3: Validate**
```
✓ Duplicate detection
✓ FK validation (siteId, areaId)
✓ Date format validation
✓ Phone number validation
✓ Region normalization
```

### **Step 4: Sync & Complete**
```
✓ Link guards → teams
✓ Sync surveys → sites
✓ Update area metrics
✓ Generate audit log
✓ Calculate KPI
```

---

## 📊 KPI DASHBOARD

Sau import thành công, kiểm tra:

```javascript
console.log('=== ALSOK VSS PRO v3.3 ===');
console.log('Tổng nhân viên:', D.guards().length);        // 150+
console.log('  - HN:', D.guards().filter(g => g.scope === 'HN').length);    // ~150
console.log('  - SR:', D.guards().filter(g => g.role === 'SR').length);     // ~50
console.log('Tổng đội SR:', D.teams().length);           // 22
console.log('Tổng mục tiêu:', D.sites().length);         // 50+
console.log('Tổng khảo sát:', D.surveys().length);       // 100+
console.log('Vùng miền:', new Set(D.teams().map(t => t.areaId)).size); // 4

// Export data
const summary = DataSync.getSummary();
console.log(summary);
```

---

## 🔍 TROUBLESHOOTING

### **Issue: Guards không link được vào teams**
```javascript
// Cause: scope = 'HN' nhưng role = 'SR'
// Fix: Kiểm tra dept column, nếu "SR" → role phải là 'SR'

// Manual fix:
D.guards().filter(g => g.role === 'SR').forEach(g => {
  const team = D.teams().find(t => t.areaId === g.areaId);
  if (team) g.teamId = team.id;
});
D.save('guards', D.guards());
```

### **Issue: Surveys không có custCode**
```javascript
// Cause: HTML parsing lỗi hoặc cột sai
// Fix: Kiểm tra file HTML structure

const result = SurveyParser.parseHTMLSurvey(htmlText);
console.log('Errors:', result.errors);
console.log('Surveys:', result.surveys);
```

### **Issue: Sites chưa được tạo**
```javascript
// Manual create missing sites
const surveys = D.surveys();
surveys.forEach(s => {
  if (!D.sites().find(site => site.id === s.siteId)) {
    D.save('sites', [...D.sites(), {
      id: s.siteId,
      name: s.custName,
      code: s.custCode,
      type: 'Customer',
      status: 'active'
    }]);
  }
});
```

---

## 📝 VALIDATION CHECKLIST

Trước khi production:

- [ ] Tất cả guards có siteId hợp lệ
- [ ] Tất cả SR guards có teamId
- [ ] Tất cả teams có areaId + region
- [ ] Tất cả surveys có custCode + custName
- [ ] Không có duplicate ID
- [ ] Tất cả FK referential integrity OK
- [ ] Area metrics updated
- [ ] Company KPI updated

---

**Version:** 3.3  
**Updated:** 2026-06-10  
**Status:** ✅ Production Ready
