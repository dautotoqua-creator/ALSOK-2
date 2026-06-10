/**
 * ═══════════════════════════════════════════════════════════════
 * SURVEY DATA PARSER v3.3 — Extract customer code & name
 * ═══════════════════════════════════════════════════════════════
 * 
 * Chuyên xử lý file khảo sát:
 * - Extract mã khách hàng (custCode)
 * - Extract tên khách hàng (custName)
 * - Parse Likert scores (1-5 stars)
 * - Link to sites collection
 * - Auto-create missing customer records
 * 
 * @author ALSOK VSS Team
 * @version 3.3
 */

const SurveyParser = {

  /**
   * Parse HTML survey file (Dữ liệu khảo sát bảo vệ 2026.htm)
   * Expected columns:
   * [0] Mã KS / Mã khách hàng
   * [1] Tên khách hàng / Mục tiêu
   * [2] Kỳ / Thời kỳ
   * [3-13] Q1-Q11 (điểm 1-5)
   * [14] Nhận xét
   */
  parseHTMLSurvey(htmlText) {
    const result = {
      surveys: [],
      customers: [],
      errors: [],
    };

    try {
      // Extract table
      const tableMatch = htmlText.match(/<table[^>]*>[\s\S]*?<\/table>/i);
      if (!tableMatch) {
        result.errors.push('No table found in HTML');
        return result;
      }

      const rows = tableMatch[0].match(/<tr[^>]*>[\s\S]*?<\/tr>/gi) || [];

      // Parse header (first row)
      const headerCells = rows[0].match(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi) || [];
      const headers = headerCells.map(cell => 
        cell.replace(/<[^>]*>/g, '').trim()
      );

      console.log('[SurveyParser] Headers:', headers);

      // Parse data rows
      rows.slice(1).forEach((row, rowIdx) => {
        const cells = row.match(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi) || [];
        
        if (cells.length < 3) return; // Skip empty/invalid rows

        const values = cells.map(cell => 
          cell.replace(/<[^>]*>/g, '').trim()
        );

        try {
          const survey = this._parseSurveyRow(values, rowIdx, headers);
          if (survey) {
            result.surveys.push(survey);

            // Add customer if new
            const custExists = result.customers.find(c => c.code === survey.custCode);
            if (!custExists) {
              result.customers.push({
                code: survey.custCode,
                name: survey.custName,
                siteId: survey.siteId,
              });
            }
          }
        } catch (err) {
          result.errors.push(`Row ${rowIdx + 1}: ${err.message}`);
        }
      });

      console.log(`[SurveyParser] Parsed ${result.surveys.length} surveys, ${result.customers.length} customers`);
      return result;
    } catch (err) {
      result.errors.push(`Parse error: ${err.message}`);
      return result;
    }
  },

  /**
   * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   * Parse single survey row
   * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   */
  _parseSurveyRow(values, rowIdx, headers) {
    if (values.length < 14) {
      throw new Error('Insufficient columns (need 14+)');
    }

    // Extract fields
    const custCode = values[0]?.trim() || `CUST_${rowIdx}`;
    const custName = values[1]?.trim() || 'Unknown';
    const period = values[2]?.trim() || new Date().getFullYear() + ' Q' + Math.ceil((new Date().getMonth() + 1) / 3);

    // Validate customer code
    if (!custCode || custCode === '') {
      throw new Error('Missing customer code');
    }

    // Parse Likert answers (Q1-Q11 = columns 3-13)
    const answers = [];
    for (let i = 3; i < 14 && i < values.length; i++) {
      const score = parseInt(values[i]?.trim()) || 3;
      if (score < 1 || score > 5) {
        answers.push(3); // Default to neutral
      } else {
        answers.push(score);
      }
    }

    // Parse comments
    const comments = values[14]?.trim() || '';

    // Calculate overall score (weighted average)
    const weights = [1.2, 1.2, 1.1, 1.1, 1.0, 1.0, 1.0, 0.9, 0.9, 0.8, 0.8]; // Q1-Q11 weights
    let weightedSum = 0;
    let weightSum = 0;
    answers.forEach((ans, idx) => {
      weightedSum += ans * (weights[idx] || 1.0);
      weightSum += weights[idx] || 1.0;
    });
    const score = (weightedSum / weightSum).toFixed(2);

    // Map to site
    const siteId = this._mapCustomerToSite(custCode, custName);

    // Determine risk level
    let risk = 'low';
    if (score < 2.5) risk = 'critical';
    else if (score < 3.5) risk = 'medium';
    else if (score >= 4.5) risk = 'excellent';

    return {
      id: `SV_${custCode}_${new Date().getFullYear()}_${rowIdx}`,
      custCode: custCode,
      custName: custName,
      siteId: siteId,
      period: period,
      score: parseFloat(score),
      risk: risk,
      answers: answers,
      comments: comments,
      evaluator: 'Automatic',
      date: new Date().toISOString().slice(0, 10),
      timestamp: new Date().toISOString(),
    };
  },

  /**
   * Parse CSV survey (alternative format)
   */
  parseCSVSurvey(csvText) {
    const result = {
      surveys: [],
      customers: [],
      errors: [],
    };

    try {
      // Remove BOM
      csvText = csvText.replace(/^\uFEFF/, '');

      const lines = csvText.split('\n').filter(l => l.trim());
      if (lines.length < 2) {
        result.errors.push('No data rows found');
        return result;
      }

      // Parse CSV
      const headers = this._parseCSVLine(lines[0]);
      
      lines.slice(1).forEach((line, rowIdx) => {
        const values = this._parseCSVLine(line);
        
        try {
          const survey = this._parseSurveyRow(values, rowIdx, headers);
          if (survey) {
            result.surveys.push(survey);

            const custExists = result.customers.find(c => c.code === survey.custCode);
            if (!custExists) {
              result.customers.push({
                code: survey.custCode,
                name: survey.custName,
                siteId: survey.siteId,
              });
            }
          }
        } catch (err) {
          result.errors.push(`Row ${rowIdx + 1}: ${err.message}`);
        }
      });

      return result;
    } catch (err) {
      result.errors.push(`Parse error: ${err.message}`);
      return result;
    }
  },

  /**
   * Parse CSV line with quoted values
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
   * Map customer code/name → siteId
   */
  _mapCustomerToSite(custCode, custName) {
    const fullText = `${custCode} ${custName}`.toUpperCase();

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
      'VSIP': 'MT-12',
      'AMATA': 'MT-13',
    };

    for (const [key, id] of Object.entries(customerMap)) {
      if (fullText.includes(key)) {
        return id;
      }
    }

    return 'MT-01'; // Default
  },

  /**
   * Validate survey data
   */
  validate(surveys) {
    const errors = [];
    const warnings = [];

    surveys.forEach((sv, idx) => {
      // Required fields
      if (!sv.custCode) errors.push(`Survey ${idx}: Missing custCode`);
      if (!sv.custName) errors.push(`Survey ${idx}: Missing custName`);
      if (!sv.siteId) errors.push(`Survey ${idx}: Missing siteId`);

      // Score validation
      if (sv.score < 1 || sv.score > 5) {
        warnings.push(`Survey ${idx}: Unusual score ${sv.score}`);
      }

      // Answers validation
      if (!Array.isArray(sv.answers) || sv.answers.length !== 11) {
        warnings.push(`Survey ${idx}: Expected 11 answers, got ${sv.answers?.length || 0}`);
      }
    });

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      totalErrors: errors.length,
      totalWarnings: warnings.length,
    };
  },

  /**
   * Generate summary statistics
   */
  generateSummary(surveys) {
    const summary = {
      total: surveys.length,
      byRisk: {
        excellent: 0,
        good: 0,
        medium: 0,
        low: 0,
        critical: 0,
      },
      bySite: {},
      avgScore: 0,
      dateRange: {
        earliest: null,
        latest: null,
      },
    };

    let scoreSum = 0;

    surveys.forEach(sv => {
      // Risk distribution
      summary.byRisk[sv.risk]++;

      // By site
      if (!summary.bySite[sv.siteId]) {
        summary.bySite[sv.siteId] = {
          count: 0,
          avgScore: 0,
        };
      }
      summary.bySite[sv.siteId].count++;

      // Score calculation
      scoreSum += sv.score;

      // Date range
      if (!summary.dateRange.earliest || sv.date < summary.dateRange.earliest) {
        summary.dateRange.earliest = sv.date;
      }
      if (!summary.dateRange.latest || sv.date > summary.dateRange.latest) {
        summary.dateRange.latest = sv.date;
      }
    });

    summary.avgScore = (scoreSum / surveys.length).toFixed(2);

    // Calculate by-site averages
    Object.keys(summary.bySite).forEach(siteId => {
      const siteSurveys = surveys.filter(s => s.siteId === siteId);
      const siteScoreSum = siteSurveys.reduce((sum, s) => sum + s.score, 0);
      summary.bySite[siteId].avgScore = (siteScoreSum / siteSurveys.length).toFixed(2);
    });

    return summary;
  },
};

// Export for use
if (typeof module !== 'undefined' && module.exports) {
  module.exports = SurveyParser;
}
