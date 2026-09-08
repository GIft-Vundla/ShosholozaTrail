import { Link } from 'react-router-dom'; import {Home,TrainFront,BookOpen,Compass,Bot} from 'lucide-react';
export function MobileTabBar(){const x=[['/','Home',Home],['/ride','Ride',TrainFront],['/stories','Stories',BookOpen],['/ai','AI Guide',Bot],['/plan','Plan',Compass]] as const;return <nav className="mobile-tabs">{x.map(([to,l,I])=><Link to={to} key={l}><I/><span>{l}</span></Link>)}</nav>}
