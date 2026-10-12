import { Dashboard } from '../../../../components/dashboard';
export default async function Page({params}:{params:Promise<{guildId:string;module:string}>}){const p=await params;return <Dashboard guildId={p.guildId} moduleId={p.module}/>;}
