/**
 * ═══════════════════════════════════════════════════════════════
 * DATA TRANSFORMER v3.3 — Chuẩn hóa & Tích hợp dữ liệu toàn quốc
 * ═══════════════════════════════════════════════════════════════
 * 
 * Cập nhật:
 * - Extract mã khách hàng & tên khách hàng từ survey data
 * - Phân biệt NV Hà Nội vs SR toàn quốc
 * - Tích hợp đồng bộ giữa modules (guards ↔ teams ↔ surveys ↔ sites)
 * - Chuẩn hóa địa chỉ, vùng miền, thời gian
 * - Validation referential integrity
 * 
 * @author ALSOK VSS Team
 * @version 3.3
 */

const DataTransformer = {
  
  /**
   * Parse CSV with BOM/encoding handling
   * Hỗ trợ: UTF-8, UTF-16, Windows-1258
   */
  parseCSV(csvText) {
    // Remove BOM (Byte Order Mark)
    csvText = csvText.replace(/^\uFEFF/, '').replace(/^\u00EF\u00BB\u00BF/, '');
    
    // Split lines
    const lines = csvText.split('\n').filter(l => l.trim());
    if (lines.length < 1) return [];
    
    // Parse headers - xử lý multi-line headers
    const headers = this._parseCSVLine(lines[0]);
    
    // Parse data rows
    const data = [];
    for (let i = 1; i < lines.length; i++) {
      const values = this._parseCSVLine(lines[i]);
      const row = {};
      headers.forEach((h, idx) => {
        row[h] = values[idx] || '';
      });
      if (Object.values(row).some(v => v)) {
        data.push(row);
      }
    }
    
    return data;
  },

  /**
   * Parse single CSV line handling quoted values
   */
  _parseCSVLine(line) {
    const result = [];
    let current = '';
    let insideQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      const nextChar = line[i + 1];

      if (char === '"') {
        if (insideQuotes && nextChar === '"') {
          current += '"';
          i++;
        } else {
          insideQuotes = !insideQuotes;
        }
      } else if (char === ',' && !insideQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }

    result.push(current.trim());
    return result;
  },

  /**
   * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   * UTILITY: Chuẩn hóa vùng/khu vực
   * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   */
  normalizeRegion(text) {
    if (!text) return { area: 'A01', region: 'Hà Nội', regionCode: 'HN' };
    
    text = text.toUpperCase().trim();
    
    // Mapping table
    const regionMap = {
      'HÀ NỘI': { area: 'A01', region: 'Hà Nội', regionCode: 'HN' },
      'HN': { area: 'A01', region: 'Hà Nội', regionCode: 'HN' },
      'NORTH': { area: 'A01', region: 'Hà Nội', regionCode: 'HN' },
      
      'TP.HCM': { area: 'A02', region: 'TP.HCM', regionCode: 'HCM' },
      'HCM': { area: 'A02', region: 'TP.HCM', regionCode: 'HCM' },
      'TPHCM': { area: 'A02', region: 'TP.HCM', regionCode: 'HCM' },
      'SOUTH': { area: 'A02', region: 'TP.HCM', regionCode: 'HCM' },
      'SÀI GÒN': { area: 'A02', region: 'TP.HCM', regionCode: 'HCM' },
      
      'HẢI PHÒNG': { area: 'A03', region: 'Hải Phòng', regionCode: 'HP' },
      'HP': { area: 'A03', region: 'Hải Phòng', regionCode: 'HP' },
      'HAIPHONG': { area: 'A03', region: 'Hải Phòng', regionCode: 'HP' },
      
      'ĐÀ NẴNG': { area: 'A04', region: 'Đà Nẵng', regionCode: 'DN' },
      'DANANG': { area: 'A04', region: 'Đà Nẵng', regionCode: 'DN' },
      'CENTRAL': { area: 'A04', region: 'Đà Nẵng', regionCode: 'DN' },
      
      'HUẾ': { area: 'A04', region: 'Huế', regionCode: 'HE' },
      'HỌC VIỆN': { area: 'A04', region: 'Huế', regionCode: 'HE' },
      
      'CẦN THƠ': { area: 'A02', region: 'Cần Thơ', regionCode: 'CT' },
      'VĨNH PHÚC': { area: 'A01', region: 'Vĩnh Phúc', regionCode: 'VP' },
      'HƯNG YÊN': { area: 'A01', region: 'Hưng Yên', regionCode: 'HY' },
      'HÀ NAM': { area: 'A01', region: 'Hà Nam', regionCode: 'HM' },
      'NINH BÌNH': { area: 'A01', region: 'Ninh Bình', regionCode: 'NB' },
    };
    
    // Exact match
    if (regionMap[text]) return regionMap[text];
    
    // Partial match
    for (const [key, value] of Object.entries(regionMap)) {
      if (text.includes(key) || key.includes(text.substring(0, 3))) {
        return value;
      }
    }
    
    // Default Hà Nội
    return { area: 'A01', region: 'Hà Nội', regionCode: 'HN' };
  },

  /**
   * Parse date formats: "DD/MM/YYYY", "MM/DD/YYYY", "YYYY/MM/DD", "DD/MM"
   * @returns {string} ISO format (YYYY-MM-DD) or null
   */
  parseDate(dateStr) {
    if (!dateStr) return null;
    
    dateStr = dateStr.toString().trim();
    if (!dateStr || dateStr === '#N/A' || dateStr === 'N/A') return null;

    dateStr = dateStr.replace(/[^\d\/\-]/g, '');

    const parts = dateStr.split(/[\/\-]/).filter(p => p);
    if (parts.length < 2) return null;

    let d, m, y;

    if (parts.length === 2) {
      [d, m] = parts;
      y = new Date().getFullYear();
    } else if (parts.length === 3) {
      const nums = parts.map(p => parseInt(p, 10));

      if (parts[0].length === 4) {
        [y, m, d] = nums;
      } else if (nums[0] > 12) {
        [d, m, y] = nums;
      } else if (nums[2] > 31) {
        [m, d, y] = nums;
      } else if (nums[0] <= 12 && nums[1] <= 31) {
        [m, d, y] = nums;
      } else {
        [d, m, y] = nums;
      }
    }

    if (!d || !m || !y) return null;
    if (m < 1 || m > 12) return null;
    if (d < 1 || d > 31) return null;

    if (y < 100) y += y < 50 ? 2000 : 1900;

    const date = new Date(y, m - 1, d);
    if (date.getFullYear() !== y || date.getMonth() !== m - 1 || date.getDate() !== d) {
      return null;
    }

    return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  },

  /**
   * Validate phone number Vietnam format
   */
  validatePhone(phone) {
    if (!phone) return null;
    phone = phone.toString().replace(/\D/g, '');
    if (/^0\d{9,10}$/.test(phone)) {
      return '0' + phone.substring(1);
    }
    return null;
  },

  /**
   * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   * TRANSFORM 1: Nhân sự CSV → guards (HÀ NỘI + TOÀN QUỐC SR)
   * Phân biệt: 
   * - Guards thường trú: Hà Nội (dept="Bảo vệ thường trú")
   * - Guards SR/QRT: Toàn quốc (dept="SR", title="SR")
   * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   */
  transformGuards(csvData) {
    if (!Array.isArray(csvData)) return [];

    return csvData
      .filter((row, idx) => {
        const dept = (row['Phòng ban'] || '').toLowerCase();
        return dept.includes('bảo vệ') || dept.includes('sr') || idx > 0;
      })
      .map((row, idx) => {
        const dept = row['Phòng ban'] || '';
        const title = row['Chức vụ'] || '';
        const status = (row['Trạng thái'] || '').includes('Đang làm') ? 'online' : 'offline';
        const muctieu = (row['Mục tiêu'] || '').trim();

        // Determine role & location scope
        let role = 'Guard';
        let scope = 'HN'; // Default Hà Nội
        let areaId = 'A01';
        
        if (title.includes('SR') || dept.includes('SR') || dept.includes('Phản ứng')) {
          role = 'SR';
          scope = 'National'; // SR toàn quốc
          // Infer area từ mục tiêu
          const regionInfo = this.normalizeRegion(muctieu);
          areaId = regionInfo.area;
        } else if (title.includes('Trưởng') || title.includes('Phó')) {
          role = 'Leader';
          scope = 'HN';
          areaId = 'A01';
        }

        const joined = this.parseDate(row['Ngày vào làm']);
        const certSec = this.parseDate(row['Ngày cấp chứng chỉ bảo vệ']);
        const certFire = this.parseDate(row['Ngày cấp chứng chỉ PCCC']);

        // Map site from "Mục tiêu"
        let siteId = 'MT-01';
        if (muctieu) {
          const siteMap = {
            'UNIQLO': 'MT-01',
            'MUJI': 'MT-02',
            'YAZAWA': 'MT-03',
            'NITTO': 'MT-04',
            'VALQUAPD': 'MT-05',
            'KURODA': 'MT-06',
            'ARTPRESTO': 'MT-07',
            'ĐẠI SỨ': 'MT-08',
          };
          for (const [key, id] of Object.entries(siteMap)) {
            if (muctieu.toUpperCase().includes(key)) {
              siteId = id;
              break;
            }
          }
        }

        return {
          id: row['Mã NV'] || `BV_${idx}`,
          name: (row['Họ và tên'] || row['Họ và tên '] || '').trim(),
          title: title.trim(),
          role: role,
          scope: scope, // ← NEW: HN hoặc National
          areaId: areaId, // ← NEW: A01-A04
          siteId: siteId,
          shift: row['Ca trực'] || 'Ca A',
          status: status,
          phone: this.validatePhone(row['Số điện thoại']) || '',
          joined: joined || '2020-01-01',
          cert: certSec ? true : false,
          certSecurity: certSec,
          certFire: certFire,
          dept: dept,
          cccd: (row['CCCD'] || '').trim(),
          age: row['Tuổi'] || '',
          gender: row['Giới tính'] || 'Nam',
          height: row['Chiều cao'] || '',
          weight: row['Cân nặng'] || '',
          education: row['Trình độ'] || '',
          notes: row['Ghi chú'] || '',
          createdAt: new Date().toISOString(),
        };
      })
      .filter(g => g.name && g.name.trim())
      .slice(0, 200);
  },

  /**
   * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   * TRANSFORM 2: SR Base CSV → teams (TOÀN QUỐC)
   * Phân biệt: 
   * - Regular teams: Hà Nội + Hải Phòng
   * - National SR: Nationwide deployment
   * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   */
  transformTeams(csvData) {
    if (!Array.isArray(csvData)) return [];

    const teams = [];
    const seen = new Set();

    csvData.forEach((row, idx) => {
      const baseName = (row['TÊN BASE'] || row['TÊN BASE '] || '').trim();
      const khuVuc = (row['Khu vực'] || row['Khu vực\n北／南'] || '').trim();
      const address = (row['ĐỊA CHỈ'] || row['ĐỊA CHỈ\n住所'] || '').trim();

      if (!baseName || seen.has(baseName)) return;
      seen.add(baseName);

      // Extract numbers
      let slKh = parseInt(
        row['Số lượng KH\ncó SR xử lý\nSR対応警備先数'] || 
        row['Số lượng KH'] || 
        0
      );
      let slNv = parseInt(
        row['Số lương NV SR \nchuyên trách\n(1)\n機動隊専従人員'] || 
        row['Số lương NV SR chuyên trách (1)'] || 
        3
      );

      // Normalize region
      const regionInfo = this.normalizeRegion(khuVuc);
      
      const teamId = `SR_${regionInfo.regionCode}_${idx + 1}`;

      teams.push({
        id: teamId,
        name: `Đội SR ${baseName.replace('BASE ', '')}`,
        baseName: baseName,
        baseId: baseName,
        areaId: regionInfo.area,
        region: regionInfo.region,
        regionCode: regionInfo.regionCode,
        address: address,
        members: slNv || 3,
        vehicle: `Xe phản ứng ${regionInfo.regionCode}-${idx + 1}`,
        status: 'ready',
        sla: regionInfo.area === 'A01' ? 15 : 20, // Hà Nội 15 phút, khác 20 phút
        customers: slKh || 0,
        scope: 'National', // ← SR toàn quốc
        foundedDate: this.parseDate(
          row['GHI CHÚ\n備考\n(Ngày Thành Lập)'] || 
          row['GHI CHÚ']
        ) || '2017-01-01',
        createdAt: new Date().toISOString(),
      });
    });

    return teams;
  },

  /**
   * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   * TRANSFORM 3: Survey HTML → surveys + sites
   * Extract: Mã khách hàng, Tên khách hàng, Điểm, Nhận xét
   * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   */
  transformSurveys(htmlData) {
    const surveys = [];
    const sites = []; // ← NEW: Extract sites from survey

    const tableMatch = htmlData.match(/<table[^>]*>[\s\S]*?<\/table>/i);
    if (!tableMatch) return { surveys, sites };

    const rows = tableMatch[0].match(/<tr[^>]*>[\s\S]*?<\/tr>/gi) || [];
    
    rows.slice(1).forEach((row, idx) => {
      const cells = row.match(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi) || [];
      
      if (cells.length >= 3) {
        const values = cells.map(cell => 
          cell.replace(/<[^>]*>/g, '').trim()
        );

        // Extract khách hàng info
        const custCode = values[0] || `CUST_${idx}`;
        const custName = values[1] || 'Unknown';
        const period = values[2] || 'Q2 2026';
        const score = parseFloat(values[3]) || 3;
        const comments = values[4] || '';

        // Map to siteId
        let siteId = this._mapSurveyToSite(custCode, custName);

        surveys.push({
          id: `SV_${custCode}_${idx}`,
          custCode: custCode,
          custName: custName,
          siteId: siteId,
          period: period,
          score: score,
          answers: [3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3],
          comments: comments,
          evaluator: 'System',
          date: new Date().toISOString().slice(0, 10),
          createdAt: new Date().toISOString(),
        });

        // Add to sites if new
        const siteExists = sites.find(s => s.id === siteId);
        if (!siteExists) {
          sites.push({
            id: siteId,
            name: custName,
            code: custCode,
            type: 'Customer',
            status: 'active',
            createdAt: new Date().toISOString(),
          });
        }
      }
    });

    return { surveys, sites };
  },

  /**
   * Helper: Map survey customer to siteId
   */
  _mapSurveyToSite(custCode, custName) {
    // Customer mapping
    const customerMap = {
      'UNIQLO': 'MT-01',
      'MUJI': 'MT-02',
      'YAZAWA': 'MT-03',
      'NITTO': 'MT-04',
      'VALQUAPD': 'MT-05',
      'KURODA': 'MT-06',
      'ARTPRESTO': 'MT-07',
      'ĐẠI SỨ': 'MT-08',
      'KOHNAN': 'MT-09',
      'BIVN': 'MT-10',
      'SR': 'MT-11',
    };

    for (const [key, id] of Object.entries(customerMap)) {
      if (custName.toUpperCase().includes(key) || custCode.toUpperCase().includes(key)) {
        return id;
      }
    }

    // Default mapping based on custCode
    const codeMap = {
      'UNIQLO': 'MT-01',
      'MUJI': 'MT-02',
      'MT': 'MT-01', // Default for MT-xx
    };

    for (const [key, id] of Object.entries(codeMap)) {
      if (custCode.includes(key)) {
        return id;
      }
    }

    return 'MT-01'; // Default
  },

  /**
   * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   * VALIDATION: Check integrity & consistency
   * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   */
  validateData(data, type = 'guards') {
    const errors = [];
    const seen = new Set();

    data.forEach((row, idx) => {
      const id = row.id || row.name;
      if (seen.has(id)) {
        errors.push(`Dòng ${idx + 1}: ID/Name trùng lặp: ${id}`);
      }
      seen.add(id);

      if (!row.name) {
        errors.push(`Dòng ${idx + 1}: Thiếu tên`);
      }

      if (type === 'guards') {
        if (!row.siteId) errors.push(`Dòng ${idx + 1}: Thiếu mục tiêu (siteId)`);
        if (row.phone && !this.validatePhone(row.phone)) {
          errors.push(`Dòng ${idx + 1}: Số điện thoại không hợp lệ`);
        }
        // Validate scope
        if (row.scope && !['HN', 'National'].includes(row.scope)) {
          errors.push(`Dòng ${idx + 1}: Scope không hợp lệ`);
        }
      }

      if (type === 'teams') {
        if (!row.areaId) errors.push(`Dòng ${idx + 1}: Thiếu area ID`);
        if (!row.scope) errors.push(`Dòng ${idx + 1}: Thiếu scope`);
      }

      if (type === 'surveys') {
        if (!row.custCode) errors.push(`Dòng ${idx + 1}: Thiếu mã khách hàng`);
        if (!row.custName) errors.push(`Dòng ${idx + 1}: Thiếu tên khách hàng`);
      }
    });

    return {
      valid: errors.length === 0,
      errors: errors,
      count: data.length,
    };
  },

  /**
   * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   * SYNC: Tích hợp đồng bộ dữ liệu giữa modules
   * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   */
  syncModules(guards, teams, surveys, sites) {
    console.log('[DataTransformer] Syncing modules...');

    // 1. Validate all foreign keys
    this._validateFK(guards, teams, surveys, sites);

    // 2. Count stats by scope & region
    const stats = {
      guards: {
        hn: guards.filter(g => g.scope === 'HN').length,
        sr: guards.filter(g => g.role === 'SR').length,
        total: guards.length,
      },
      teams: {
        national: teams.length,
        byArea: {},
      },
      surveys: {
        total: surveys.length,
        bySite: {},
      },
      sites: {
        total: sites.length,
        active: sites.filter(s => s.status === 'active').length,
      },
    };

    // Count by area
    teams.forEach(t => {
      stats.teams.byArea[t.areaId] = (stats.teams.byArea[t.areaId] || 0) + 1;
    });

    // Count surveys by site
    surveys.forEach(s => {
      stats.surveys.bySite[s.siteId] = (stats.surveys.bySite[s.siteId] || 0) + 1;
    });

    console.log('[DataTransformer] Sync stats:', stats);
    return stats;
  },

  /**
   * Validate referential integrity
   */
  _validateFK(guards, teams, surveys, sites) {
    const siteIds = new Set(sites.map(s => s.id));
    const areaIds = new Set(teams.map(t => t.areaId));

    // Check guards → sites
    guards.forEach(g => {
      if (g.siteId && !siteIds.has(g.siteId)) {
        console.warn(`⚠️ Guard ${g.id}: Invalid siteId ${g.siteId}`);
      }
      if (g.areaId && !areaIds.has(g.areaId) && g.role === 'SR') {
        console.warn(`⚠️ Guard ${g.id}: Invalid areaId ${g.areaId}`);
      }
    });

    // Check surveys → sites
    surveys.forEach(sv => {
      if (sv.siteId && !siteIds.has(sv.siteId)) {
        console.warn(`⚠️ Survey ${sv.id}: Invalid siteId ${sv.siteId}`);
      }
    });

    console.log('✓ FK validation completed');
  },

  generateId(prefix = 'ID') {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  },
};

// Export for use
if (typeof module !== 'undefined' && module.exports) {
  module.exports = DataTransformer;
}
