import React from 'react';
import { useLanguage } from '../context/LanguageContext';
interface FooterProps { onFeedbackClick?: () => void }
export const Footer: React.FC<FooterProps> = () => {
 const {language} = useLanguage();
 return <footer className="studio-footer"><span>Écriture <span>·</span> {language === 'en' ? 'A little practice, every day.' : 'Un peu de pratique, chaque jour.'}</span><span>{language === 'en' ? 'AI feedback is an estimate.' : 'Le bilan IA reste une estimation.'}</span></footer>;
};
