// src/hooks/useOperators.js
// -----------------------------------------------------------------------------
// Liste partagée des opérateurs (table stock_operators), chargée une fois et partagée par
// tous les champs Opérateur ouverts. rememberOperator() ajoute un nom inconnu à la liste
// (à l'enregistrement d'une action) : il est ensuite proposé sur toutes les tablettes.
// -----------------------------------------------------------------------------
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { cleanOperatorName, isKnownOperator, uniqueOperatorNames } from '../lib/operators';

// Liste de départ : sert seulement si la table n'est pas lisible (pas encore créée, réseau).
const STARTING_OPERATORS = [
    'Alain Houdemont', 'Alison Gloaguen', 'Audry Papin', 'Catherine Bosse', 'David Vergel', 'Delphine Butez',
    'Elisa Laprune', 'Emilie David', 'Florence Gobbe', 'Guillaume Mailly', 'Julie Rabin', 'Lucie Jaulin',
    'Maelane Poulaud', 'Malcolm Jeantal', 'Samuel Blandin', 'Thierry Menant', 'Thomas Bonnet',
];

let names = STARTING_OPERATORS;
let loading = null;
const listeners = new Set();
const publish = (next) => { names = uniqueOperatorNames(next); listeners.forEach((fn) => fn(names)); };

function load() {
    if (!loading) {
        loading = supabase.from('stock_operators').select('name').then(({ data, error }) => {
            if (!error && data) publish(data.map((r) => r.name));
            else loading = null; // nouvel essai au prochain champ ouvert
        });
    }
    return loading;
}

/** Ajoute le nom à la liste partagée s'il n'y est pas (sans doublon). N'échoue jamais. */
export async function rememberOperator(name) {
    const clean = cleanOperatorName(name);
    if (!clean || isKnownOperator(clean, names)) return;
    publish([...names, clean]);
    try {
        const { error } = await supabase.from('stock_operators').insert([{ name: clean }]);
        if (error && error.code !== '23505') console.warn('Opérateur non mémorisé :', error.message); // 23505 = déjà ajouté ailleurs
    } catch (e) {
        console.warn('Opérateur non mémorisé :', e);
    }
}

export function useOperators() {
    const [list, setList] = useState(names);
    useEffect(() => {
        listeners.add(setList);
        load();
        return () => { listeners.delete(setList); };
    }, []);
    return list;
}
