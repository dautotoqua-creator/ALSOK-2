/**
 * ═══════════════════════════════════════════════════════════════
 * DATA SYNC ENGINE v3.3 — Auto-sync module integration
 * ═══════════════════════════════════════════════════════════════
 * 
 * Cập nhật:
 * - Sync guards → teams → surveys → sites
 * - Handle regional scopes (HN vs National SR)
 * - Auto-create missing references
 * - Update company/area KPI
 * 
 * @author ALSOK VSS Team
 * @version 3.3
 */

const DataSync = {

  /**
   * Main orchestrator - Run after any data import
   */
  runAll() {
    console.log('[DataSync v3.3] Starting full synchronization...');
    
    try {
      this.syncGuardsToTeams();
      this.syncTeamsToAreas();
      this.syncSurveyToSites();
      this.updateAreaMetrics();
      this.validateIntegrity();
      
      console.log('[DataSync] ✓ Synchronization completed');
      return { success: true, timestamp: new Date().toISOString() };
    } catch (err) {
      console.error('[DataSync] ✗ Error:', err);
      return { success: false, error: err.message };
    }
  },

  /**
   * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   * SYNC 1: Guards ↔ Teams (Role-based mapping)
   * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   */
  syncGuardsToTeams() {
    if (typeof D === 'undefined') return;

    const guards = D.guards() || [];
    const teams = D.teams() || [];

    let updated = 0;

    // 1. Link SR guards to national teams
    const srGuards = guards.filter(g => g.role === 'SR');
    srGuards.forEach(g => {
      if (!g.teamId && g.areaId) {
        // Find team in same area
        const team = teams.find(t => t.areaId === g.areaId && t.scope === 'National');
        if (team) {
          g.teamId = team.id;
          updated++;
        }
      }
    });

    // 2. Link regular guards to sites
    const regularGuards = guards.filter(g => g.scope === 'HN' && g.role !== 'SR');
    regularGuards.forEach(g => {
      if (!g.siteId) {
        g.siteId = 'MT-01'; // Default Hà Nội
        updated++;
      }
    });

    if (updated > 0) {
      D.save('guards', guards);
      console.log(`[DataSync] Linked ${updated} guards to teams/sites`);
    }
  },

  /**
   * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   * SYNC 2: Teams ↔ Areas (Regional integration)
   * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   */
  syncTeamsToAreas() {
    if (typeof D === 'undefined') return;

    const teams = D.teams() || [];
    const areas = D.areas ? D.areas() : [];

    let updated = 0;

    teams.forEach(t => {
      // Ensure areaId is set
      if (!t.areaId) {
        t.areaId = 'A01'; // Default Hà Nội
        updated++;
      }

      // Ensure region is normalized
      if (!t.region) {
        const regionInfo = this._normalizeRegion(t.areaId);
        t.region = regionInfo;
        updated++;
      }

      // Ensure SLA is set based on area
      if (!t.sla) {
        t.sla = t.areaId === 'A01' ? 15 : 20;
        updated++;
      }
    });

    if (updated > 0) {
      D.save('teams', teams);
      console.log(`[DataSync] Updated ${updated} teams with area info`);
    }
  },

  /**
   * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   * SYNC 3: Surveys → Sites (Customer mapping)
   * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   */
  syncSurveyToSites() {
    if (typeof D === 'undefined') return;

    const surveys = D.surveys() || [];
    const sites = D.sites() || [];

    let updated = 0;

    surveys.forEach(sv => {
      // Auto-create site if missing
      if (!sv.siteId) {
        let siteId = this._mapCustomerToSite(sv.custName || sv.custCode);
        sv.siteId = siteId;
        updated++;

        // Add site if not exists
        if (!sites.find(s => s.id === siteId)) {
          sites.push({
            id: siteId,
            name: sv.custName || 'Unknown',
            code: sv.custCode || 'CUST_AUTO',
            type: 'Customer',
            status: 'active',
            createdAt: new Date().toISOString(),
          });
          updated++;
        }
      }
    });

    if (updated > 0) {
      D.save('surveys', surveys);
      if (sites.length > 0) D.save('sites', sites);
      console.log(`[DataSync] Synced ${updated} surveys with sites`);
    }
  },

  /**
   * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   * UPDATE: Area KPI metrics
   * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   */
  updateAreaMetrics() {
    if (typeof D === 'undefined') return;

    const guards = D.guards() || [];
    const teams = D.teams() || [];
    const companies = D.companies ? D.companies() : [];

    // Calculate metrics by area
    const areaMetrics = {};

    teams.forEach(t => {
      if (!areaMetrics[t.areaId]) {
        areaMetrics[t.areaId] = {
          areaId: t.areaId,
          teams: 0,
          guards: 0,
          srGuards: 0,
          minSLA: t.sla,
        };
      }
      areaMetrics[t.areaId].teams++;
      areaMetrics[t.areaId].minSLA = Math.min(areaMetrics[t.areaId].minSLA, t.sla);
    });

    guards.forEach(g => {
      if (g.areaId && areaMetrics[g.areaId]) {
        areaMetrics[g.areaId].guards++;
        if (g.role === 'SR') {
          areaMetrics[g.areaId].srGuards++;
        }
      }
    });

    // Update companies with area metrics
    companies.forEach(c => {
      if (areaMetrics[c.areaId]) {
        c.teamCount = areaMetrics[c.areaId].teams;
        c.sla = areaMetrics[c.areaId].minSLA;
      }
    });

    D.save('companies', companies);
    console.log('[DataSync] ✓ Area metrics updated:', areaMetrics);
  },

  /**
   * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   * VALIDATE: Check all references
   * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   */
  validateIntegrity() {
    if (typeof D === 'undefined') return;

    const guards = D.guards() || [];
    const teams = D.teams() || [];
    const sites = D.sites() || [];
    const surveys = D.surveys() || [];

    const issues = {
      orphanGuards: [],
      orphanSurveys: [],
      orphanTeams: [],
      warnings: [],
    };

    // Check orphan guards
    guards.forEach(g => {
      if (g.role === 'SR' && !g.teamId) {
        issues.warnings.push(`Guard ${g.id}: Not assigned to team`);
      }
      if (!g.siteId) {
        issues.orphanGuards.push(g.id);
      }
    });

    // Check orphan surveys
    surveys.forEach(s => {
      if (!sites.find(st => st.id === s.siteId)) {
        issues.orphanSurveys.push(s.id);
      }
    });

    // Check orphan teams
    teams.forEach(t => {
      if (!t.areaId) {
        issues.orphanTeams.push(t.id);
      }
    });

    const total = 
      issues.orphanGuards.length +
      issues.orphanSurveys.length +
      issues.orphanTeams.length;

    console.log('[DataSync] Integrity check:', {
      total_issues: total,
      details: issues,
    });

    return { valid: total === 0, issues };
  },

  /**
   * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   * HELPER: Normalize region info
   * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   */
  _normalizeRegion(areaId) {
    const map = {
      'A01': { area: 'A01', region: 'Hà Nội', code: 'HN' },
      'A02': { area: 'A02', region: 'TP.HCM', code: 'HCM' },
      'A03': { area: 'A03', region: 'Hải Phòng', code: 'HP' },
      'A04': { area: 'A04', region: 'Đà Nẵng', code: 'DN' },
    };
    return map[areaId] || map['A01'];
  },

  /**
   * HELPER: Map customer name to site ID
   */
  _mapCustomerToSite(custName) {
    const map = {
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

    for (const [key, id] of Object.entries(map)) {
      if (custName.toUpperCase().includes(key)) {
        return id;
      }
    }
    return 'MT-01';
  },

  /**
   * Export summary report
   */
  getSummary() {
    if (typeof D === 'undefined') return null;

    const guards = D.guards() || [];
    const teams = D.teams() || [];
    const sites = D.sites() || [];
    const surveys = D.surveys() || [];

    return {
      data: {
        guards: guards.length,
        guardsHN: guards.filter(g => g.scope === 'HN').length,
        guardsSR: guards.filter(g => g.role === 'SR').length,
        teams: teams.length,
        sites: sites.length,
        surveys: surveys.length,
      },
      timestamp: new Date().toISOString(),
    };
  },
};

// Auto-run on page load
window.addEventListener('load', () => {
  const lastImport = localStorage.getItem('ALSOK_last_import_time');
  const now = Date.now();
  
  if (lastImport && (now - parseInt(lastImport)) < 5000) {
    DataSync.runAll();
    // Show summary
    const summary = DataSync.getSummary();
    console.log('[DataSync] Summary:', summary);
  }
});
