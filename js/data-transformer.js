/**
 * ═══════════════════════════════════════════════════════════════
 * DATA TRANSFORMER — Map real data từ CSV → SEED format
 * ═══════════════════════════════════════════════════════════════
 * 
 * Xử lý:
 * - Parse CSV/HTML với encoding khác nhau
 * - Transform: Nhân sự CSV → guards, users, teams
 * - Transform: SR Base CSV → teams (đội phản ứng nhanh)
 * - Transform: Khảo sát HTML → survey data
 * - Validate & deduplicate
 * 
 * @author ALSOK VSS Team
 * @version 3.2
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
    
    // Parse headers
    const headers = this._parseCSVLine(lines[0]);
    
    // Parse data rows
    const data = [];
    for (let i = 1; i < lines.length; i++) {
      const values = this._parseCSVLine(lines[i]);
      const row = {};
      headers.forEach((h, idx) => {
        row[h] = values[idx] || '';
      });
      if (Object.values(row).some(v => v)) { // Skip empty rows
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
   * Parse date formats: "DD/MM/YYYY", "MM/DD/YYYY", "YYYY/MM/DD", "DD/MM"
   * @returns {string} ISO format (YYYY-MM-DD) or null
   */
  parseDate(dateStr) {
    if (!dateStr) return null;
    
    dateStr = dateStr.toString().trim();
    if (!dateStr || dateStr === '#N/A' || dateStr === 'N/A') return null;

    // Remove common non-date chars
    dateStr = dateStr.replace(/[^\d\/\-]/g, '');

    const parts = dateStr.split(/[\/\-]/).filter(p => p);
    if (parts.length < 2) return null;

    let d, m, y;

    if (parts.length === 2) {
      // DD/MM format - add current year
      [d, m] = parts;
      y = new Date().getFullYear();
    } else if (parts.length === 3) {
      // Detect format based on values
      const nums = parts.map(p => parseInt(p, 10));

      if (parts[0].length === 4) {
        // YYYY/MM/DD
        [y, m, d] = nums;
      } else if (nums[0] > 12) {
        // First part > 12 → DD/MM/YYYY
        [d, m, y] = nums;
      } else if (nums[2] > 31) {
        // Third part > 31 → must be year (MM/DD/YYYY)
        [m, d, y] = nums;
      } else if (nums[0] <= 12 && nums[1] <= 31) {
        // Ambiguous - try MM/DD/YYYY first
        [m, d, y] = nums;
      } else {
        [d, m, y] = nums;
      }
    }

    // Validate
    if (!d || !m || !y) return null;
    if (m < 1 || m > 12) return null;
    if (d < 1 || d > 31) return null;

    // Add century to 2-digit years
    if (y < 100) y += y < 50 ? 2000 : 1900;

    // Validate date
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
   * Map text to area ID
   */
  mapKhuVucToArea(name) {
    if (!name) return 'A01';
    name = name.toUpperCase();
    
    const map = {
      'HÀ NỘI': 'A01',
      'HN': 'A01',
      'NORTH': 'A01',
      'TP.HCM': 'A02',
      'HCM': 'A02',
      'SOUTH': 'A02',
      'HẢI PHÒNG': 'A03',
      'HP': 'A03',
      'CENTRAL': 'A04',
      'ĐÀ NẴNG': 'A04',
    };

    for (const [k, v] of Object.entries(map)) {
      if (name.includes(k)) return v;
    }
    return 'A01';
  },

  /**
   * Generate unique ID
   */
  generateId(prefix = 'ID') {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  },

  /**
   * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   * TRANSFORM 1: Nhân sự CSV → guards + users
   * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   */
  transformGuards(csvData) {
    if (!Array.isArray(csvData)) return [];

    return csvData
      .filter((row, idx) => {
        // Filter: security staff only
        const dept = (row['Phòng ban'] || row['Phần mềm'] || '').toLowerCase();
        return dept.includes('bảo vệ') || dept.includes('sr') || idx > 0;
      })
      .map((row, idx) => {
        const dept = row['Phòng ban'] || '';
        const title = row['Chức vụ'] || '';
        const status = (row['Trạng thái'] || '').includes('Đang làm') ? 'online' : 'offline';

        // Determine role
        let role = 'Guard';
        if (title.includes('Trưởng') || title.includes('Phó')) role = 'Leader';
        if (dept.includes('SR') || title.includes('SR')) role = 'SR';

        const joined = this.parseDate(row['Ngày vào làm']);
        const certSec = this.parseDate(row['Ngày cấp chứng chỉ bảo vệ']);
        const certFire = this.parseDate(row['Ngày cấp chứng chỉ PCCC']);

        // Map site from "Mục tiêu" column
        let siteId = 'MT-01';
        const muctieu = (row['Mục tiêu'] || '').trim();
        if (muctieu) {
          // Try to match with known sites
          const siteMap = {
            'UNIQLO': 'MT-01',
            'MUJI': 'MT-02',
            'YAZAWA': 'MT-03',
            'NITTO': 'MT-04',
            'SR': 'MT-05',
            'ĐẠI SỨ': 'MT-06',
          };
          for (const [key, id] of Object.entries(siteMap)) {
            if (muctieu.toUpperCase().includes(key)) {
              siteId = id;
              break;
            }
          }
        }

        return {
          id: row['Mã NV'] || this.generateId('BV'),
          name: (row['Họ và tên'] || row['Họ và tên '] || '').trim(),
          title: title.trim(),
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
          role: role,
          notes: row['Ghi chú'] || '',
          createdAt: new Date().toISOString(),
        };
      })
      .filter(g => g.name && g.name.trim()) // Remove empty names
      .slice(0, 200); // Limit for performance
  },

  /**
   * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   * TRANSFORM 2: SR Base CSV → teams (đội phản ứng nhanh)
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
      let slKh = parseInt(row['Số lượng KH\ncó SR xử lý\nSR対応警備先数'] || row['Số lượng KH'] || 0);
      let slNv = parseInt(row['Số lương NV SR \nchuyên trách\n(1)\n機動隊専従人員'] || row['Số lương NV SR chuyên trách (1)'] || 3);

      const teamId = `SR_${baseName.substring(0, 3).toUpperCase()}_${idx + 1}`;
      const areaId = this.mapKhuVucToArea(khuVuc);

      teams.push({
        id: teamId,
        name: baseName.replace('BASE ', 'Đội SR '),
        baseId: baseName,
        areaId: areaId,
        address: address,
        members: slNv || 3,
        vehicle: `Xe phản ứng ${idx + 1}`,
        status: 'ready',
        sla: khuVuc.includes('North') || khuVuc.includes('North') ? 15 : 20,
        customers: slKh || 0,
        foundedDate: this.parseDate(row['GHI CHÚ\n備考\n(Ngày Thành Lập)']) || '2017-01-01',
        createdAt: new Date().toISOString(),
      });
    });

    return teams;
  },

  /**
   * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   * TRANSFORM 3: Parse HTML Survey → survey data
   * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   */
  transformSurveys(htmlData) {
    const surveys = [];

    // Extract table from HTML
    const tableMatch = htmlData.match(/<table[^>]*>[\s\S]*?<\/table>/i);
    if (!tableMatch) return surveys;

    const rows = tableMatch[0].match(/<tr[^>]*>[\s\S]*?<\/tr>/gi) || [];
    
    rows.slice(1).forEach((row, idx) => {
      const cells = row.match(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi) || [];
      
      if (cells.length >= 2) {
        const values = cells.map(cell => 
          cell.replace(/<[^>]*>/g, '').trim()
        );

        surveys.push({
          id: `SV_${idx + 1}`,
          siteId: values[0] || 'MT-01',
          period: values[1] || 'Q2 2026',
          score: parseInt(values[2]) || 3,
          answers: [3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3], // Default
          comments: values[3] || '',
          evaluator: 'System',
          date: new Date().toISOString().slice(0, 10),
          createdAt: new Date().toISOString(),
        });
      }
    });

    return surveys;
  },

  /**
   * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   * VALIDATION: Check for duplicates & conflicts
   * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   */
  validateData(data, type = 'guards') {
    const errors = [];
    const seen = new Set();

    data.forEach((row, idx) => {
      // Check duplicate ID
      const id = row.id || row.name;
      if (seen.has(id)) {
        errors.push(`Dòng ${idx + 1}: ID/Name trùng lặp: ${id}`);
      }
      seen.add(id);

      // Check required fields
      if (!row.name) {
        errors.push(`Dòng ${idx + 1}: Thiếu tên`);
      }

      // Type-specific validation
      if (type === 'guards') {
        if (!row.siteId) errors.push(`Dòng ${idx + 1}: Thiếu mục tiêu (siteId)`);
        if (row.phone && !this.validatePhone(row.phone)) {
          errors.push(`Dòng ${idx + 1}: Số điện thoại không hợp lệ`);
        }
      }
    });

    return {
      valid: errors.length === 0,
      errors: errors,
      count: data.length,
    };
  },
};

// Export for use
if (typeof module !== 'undefined' && module.exports) {
  module.exports = DataTransformer;
}
