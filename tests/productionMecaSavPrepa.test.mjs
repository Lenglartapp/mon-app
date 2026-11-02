// Production : Type Méca en liste, statut SAV, avancement de la prépa par typologie.
// Lancer : npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
    SANS_MECA, TYPE_MECANISME_OPTIONS, isSansMeca, upgradeLegacyOption,
} from '../src/lib/constants/rideauxFields.js';
import { STATUT_SAV, STATUT_PREPA_OPTIONS, STATUT_POSE_OPTIONS, isTermine } from '../src/lib/constants/statutsProduction.js';
import { getPrepaTypology } from '../src/lib/constants/productRouting.js';
import { calculateProjectStats } from '../src/lib/projectMetrics.js';
import { getStatutConfOptions } from '../src/lib/schemas/production.js';
import { DEFAULT_VIEWS } from '../src/lib/constants/views.js';

test('Type Méca : liste commune, ancien « Sans Méca » reconnu et converti à l’import', () => {
    assert.deepEqual(TYPE_MECANISME_OPTIONS, ['Rail', 'Tringle', 'Rail Motorisé', 'Sans Méca/Méca existant']);
    assert.ok(isSansMeca(SANS_MECA));
    assert.ok(isSansMeca('Sans Méca'));
    assert.ok(!isSansMeca('Rail'));
    assert.equal(upgradeLegacyOption('type_mecanisme', 'Sans Méca'), SANS_MECA);
    assert.equal(upgradeLegacyOption('type_mecanisme', 'Rail cintré'), 'Rail cintré'); // hors liste conservé
    assert.equal(upgradeLegacyOption('modele_mecanisme', 'Sans Méca'), 'Sans Méca');
});

test('SAV : dernière option des statuts, compte comme terminé', () => {
    assert.equal(STATUT_PREPA_OPTIONS.at(-1), STATUT_SAV);
    assert.equal(STATUT_POSE_OPTIONS.at(-1), STATUT_SAV);
    for (const p of ['Rideau', 'Store Bateau', 'Coussin', 'Tenture Murale']) {
        assert.equal(getStatutConfOptions(p).at(-1), STATUT_SAV, p);
    }
    assert.ok(isTermine('SAV') && isTermine('Terminé') && !isTermine('En cours'));

    const s = calculateProjectStats([
        { produit: 'Rideau', statut_prepa: 'SAV', statut_pose: 'SAV', statut_conf: 'SAV', heures_confection: 2 },
        { produit: 'Rideau', statut_prepa: 'Terminé', statut_pose: 'Terminé', statut_conf: 'Emballé', heures_confection: 2 },
    ]);
    assert.equal(s.pctPrepa, 100);
    assert.equal(s.pctPose, null); // pas de budget pose : non applicable, inchangé
    assert.equal(s.raw.poseOk, 2);
    assert.equal(s.raw.confHouresDone, 4);
});

test('BPF rideaux sans « Modèle »', () => {
    assert.ok(!DEFAULT_VIEWS.bpf.rideaux.includes('modele_mecanisme'));
    assert.ok(DEFAULT_VIEWS.bpf.rideaux.includes('type_mecanisme'));
});

test('typologie de prépa : périmètre', () => {
    assert.equal(getPrepaTypology({ produit: 'Voilage' }).key, 'rideaux');
    assert.equal(getPrepaTypology({ produit: 'Store Bateau' }).key, 'stores_bateaux');
    assert.equal(getPrepaTypology({ produit: 'Store Enrouleur Toile' }).key, 'stores_classiques');
    assert.equal(getPrepaTypology({ produit: 'Tenture Murale' }).key, 'tenture_murale');
    assert.equal(getPrepaTypology({ produit: 'Cantonnière' }).key, 'mobilier');
    assert.equal(getPrepaTypology({ produit: '' }).key, 'autres');
    for (const p of ['Coussin', 'Plaid', 'Chemin de lit', 'Cache-sommier']) {
        assert.equal(getPrepaTypology({ produit: p }), null, p);
    }
    assert.equal(getPrepaTypology({ produit: 'Rideau', pair_role: 'left' }), null);
    assert.equal(getPrepaTypology({ produit: 'Rideau', pair_role: 'parent' }).key, 'rideaux');
});

test('avancement prépa : 4 rideaux préparés + 2 tentures non préparées', () => {
    const rows = [
        ...Array.from({ length: 4 }, () => ({ produit: 'Rideau', statut_prepa: 'Terminé' })),
        { produit: 'Tenture Murale', statut_prepa: 'Non démarré' },
        { produit: 'Tenture Murale' },
        { produit: 'Coussin', statut_prepa: 'Terminé' },
        { produit: 'Chemin de lit' },
    ];
    const s = calculateProjectStats(rows);
    assert.equal(s.pctPrepa, 67);
    assert.equal(s.raw.prepaTotal, 6);
    assert.deepEqual(s.prepaByType, [
        { key: 'rideaux', label: 'Rideaux', ok: 4, total: 4, pct: 100 },
        { key: 'tenture_murale', label: 'Tentures murales', ok: 0, total: 2, pct: 0 },
    ]);
});

test('avancement prépa : paire décentrée comptée une fois, un seul type = une seule entrée', () => {
    const s = calculateProjectStats([
        { produit: 'Rideau', pair_role: 'parent', statut_prepa: 'Terminé' },
        { produit: 'Rideau', pair_role: 'left', statut_prepa: 'Terminé' },
        { produit: 'Rideau', pair_role: 'right' },
        { produit: 'Rideau' },
    ]);
    assert.equal(s.raw.prepaTotal, 2);
    assert.equal(s.raw.prepaOk, 1);
    assert.equal(s.prepaByType.length, 1);
});
