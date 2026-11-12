import React, { useState } from 'react';
import { useLanguage } from '../context/LanguageContext';
interface FeedbackProps { onHomeClick: () => void; userEmail?: string | null; hideHeader?: boolean }
export const Feedback: React.FC<FeedbackProps> = ({onHomeClick}) => {
 const {language} = useLanguage(); const en = language === 'en';
 const [note,setNote] = useState(()=>localStorage.getItem('ecriture_personal_notes') || '');
 const [saved,setSaved] = useState(false); const [error,setError] = useState('');
 return <section className="studio-notes"><p className="studio-eyebrow">{en?'A SPACE TO REFLECT':'UN ESPACE POUR RÉFLÉCHIR'}</p><h2>{en?'What will you work on next?':'Quel sera votre prochain objectif ?'}</h2><p>{en?'Keep your practice goals and observations here. Notes stay in this browser.':'Gardez ici vos objectifs et vos observations. Ces notes restent dans ce navigateur.'}</p><label htmlFor="personal-note">{en?'Your notes':'Vos notes'}</label><textarea id="personal-note" value={note} onChange={e=>{setNote(e.target.value);setSaved(false);}} rows={10}/><div className="flex gap-3 mt-4"><button className="studio-primary" onClick={()=>{try{localStorage.setItem('ecriture_personal_notes',note);setSaved(true);setError('');}catch{setError(en?'Could not save. Copy your note before leaving.':'Enregistrement impossible. Copiez votre note avant de quitter.');}}}>{en?'Save notes':'Enregistrer'}</button><button className="studio-secondary" onClick={onHomeClick}>{en?'Back to practice':'Retour à la pratique'}</button></div><p role="status">{error || (saved ? (en?'Saved in this browser.':'Enregistré dans ce navigateur.') : '')}</p></section>;
};
