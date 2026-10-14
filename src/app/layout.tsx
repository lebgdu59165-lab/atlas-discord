import type { Metadata } from 'next';
import './globals.css';
import './pro.css';
export const metadata:Metadata={title:'Atlas — Centre de contrôle Discord',description:'Administration de votre communauté Discord : configuration, modération et modules.'};
export default function Layout({children}:{children:React.ReactNode}){return <html lang="fr"><body>{children}</body></html>;}
