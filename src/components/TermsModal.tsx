import React from 'react';

interface TermsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const TermsModal: React.FC<TermsModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn">
      <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <span className="text-xl">⚖️</span>
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Conditions d'utilisation & Clause de non-responsabilité
              </h2>
              <p className="text-xs text-slate-500">
                Terms of Service, Copyright Disclaimer & Educational Notice
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 text-xl font-bold p-1 rounded hover:bg-slate-200 leading-none cursor-pointer"
            aria-label="Fermer"
          >
            ✕
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-4 text-xs text-slate-700 leading-relaxed">
          {/* Prominent Legal Protection Banner */}
          <div className="p-4 rounded-lg bg-amber-50 border border-amber-300 text-amber-950 space-y-2">
            <h3 className="font-extrabold text-sm flex items-center gap-2 text-amber-900">
              <span>⚠️</span>
              <span>AVIS LÉGAL ESSENTIEL / ESSENTIAL LEGAL NOTICE</span>
            </h3>
            <p className="font-medium text-xs leading-normal">
              <strong>Ce site web est un projet bénévole, entièrement gratuit et sans but lucratif, créé uniquement à des fins d'entraînement et de pratique personnelle de l'expression écrite pour aider les étudiants.</strong>
            </p>
            <p className="text-xs leading-normal text-amber-900 border-t border-amber-200/80 pt-2">
              <strong>English:</strong> This website is an independent, non-commercial, free practice tool created strictly for students to practice French writing under simulated exam conditions. <strong>The creator does NOT claim or hold any copyright or ownership over official exam materials.</strong> Everything was compiled voluntarily to assist students and candidates in their educational preparation.
            </p>
          </div>

          {/* Section 1: Non-revendication de droits d'auteur */}
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-3.5 space-y-1.5">
            <h4 className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
              <span className="text-blue-600 font-bold">1.</span>
              <span>Absence de droits d'auteur & Non-affiliation officielle</span>
            </h4>
            <p className="text-slate-600">
              L'auteur et exploitant de ce site déclare expressément ne posséder aucun droit d'auteur ni titre de propriété intellectuelle sur les énoncés de sujets ou textes d'examen présentés. Les énoncés sont issus de partages publics entre anciens candidats et d'exemples d'entraînement collectés sur le Web à des fins d'étude.
            </p>
            <p className="text-slate-600">
              Ce site web est un outil indépendant et n'est <strong>en aucun cas affilié, associé, autorisé, approuvé ou sponsorisé par France Éducation international, le Ministère de l'Éducation nationale français, ou tout organisme officiel</strong> lié au TCF Canada. Toutes les marques déposées mentionnées appartiennent exclusivement à leurs propriétaires légitimes respectifs.
            </p>
          </div>

          {/* Section 2: Usage loyal et exception pédagogique (Fair Use) */}
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-3.5 space-y-1.5">
            <h4 className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
              <span className="text-blue-600 font-bold">2.</span>
              <span>Finalité strictement pédagogique & Exception d'enseignement</span>
            </h4>
            <p className="text-slate-600">
              La reproduction d'énoncés est effectuée de bonne foi dans le cadre exclusif de la citation, de l'illustration pédagogique et de l'entraînement gratuit (Fair Use / exception pédagogique). Ce site ne génère aucun profit, n'affiche aucune publicité rémunérée, ne vend aucun produit ni abonnement payant.
            </p>
          </div>

          {/* Section 3: Procédure de retrait amiable (Takedown / DMCA Safe Harbor) */}
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-3.5 space-y-1.5">
            <h4 className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
              <span className="text-blue-600 font-bold">3.</span>
              <span>Clause de bonne foi & Procédure de retrait immédiat</span>
            </h4>
            <p className="text-slate-600">
              Si vous êtes détenteur de droits sur un texte ou sujet particulier et que vous ne souhaitez pas que ce texte apparaisse à des fins d'entraînement gratuit pour les étudiants, <strong>veuillez contacter l'administrateur du site avec les références exactes du contenu concerné. Le contenu sera retiré immédiatement et sans délai</strong> dans un esprit de pleine coopération.
            </p>
          </div>

          {/* Section 4: Limitation totale de responsabilité */}
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-3.5 space-y-1.5">
            <h4 className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
              <span className="text-blue-600 font-bold">4.</span>
              <span>Dégagement de garantie & Limitation de responsabilité</span>
            </h4>
            <p className="text-slate-600">
              Le service est fourni « tel quel » et « selon disponibilité ». L'auteur décline toute responsabilité quant à l'exactitude des sujets, aux résultats obtenus lors des épreuves officielles, ou à toute interruption de service. Les utilisateurs s'exercent sous leur propre responsabilité.
            </p>
          </div>

          {/* Section 5: Confidentialité des rédactions */}
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-3.5 space-y-1.5">
            <h4 className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
              <span className="text-blue-600 font-bold">5.</span>
              <span>Protection et confidentialité des écrits des étudiants</span>
            </h4>
            <p className="text-slate-600">
              Vos rédactions sont enregistrées de façon strictement privée et confidentielle dans votre compte personnel pour vous permettre de revoir votre travail. Elles ne sont ni vendues, ni partagées, ni utilisées à des fins commerciales.
            </p>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3.5 border-t border-slate-200 bg-slate-50 flex items-center justify-between shrink-0">
          <span className="text-[11px] text-slate-500 font-medium">
            Projet bénévole d'aide aux candidats TCF Canada
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg transition-colors cursor-pointer"
          >
            J'accepte & Fermer
          </button>
        </div>
      </div>
    </div>
  );
};
