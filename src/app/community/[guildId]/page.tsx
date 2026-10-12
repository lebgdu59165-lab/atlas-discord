import { Community } from '../../../components/community';
export default async function Page({params}:{params:Promise<{guildId:string}>}){const p=await params;return <Community guildId={p.guildId}/>;}
