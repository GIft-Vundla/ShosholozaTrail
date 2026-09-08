import { Routes, Route } from 'react-router-dom';
import { Landing } from './components/Landing';
import { JourneyExperience } from './components/JourneyExperience';
import { Destinations } from './components/Destinations';
import { Stories } from './components/Stories';
import { Plan } from './components/Plan';
import { Credits } from './components/Credits';
import { Ride } from './components/Ride';
import { AiGuide } from './components/AiGuide';
export default function App(){return <Routes><Route path="/" element={<Landing/>}/><Route path="/journey" element={<JourneyExperience/>}/><Route path="/ride" element={<Ride/>}/><Route path="/ai" element={<AiGuide/>}/><Route path="/destinations" element={<Destinations/>}/><Route path="/stories" element={<Stories/>}/><Route path="/plan" element={<Plan/>}/><Route path="/credits" element={<Credits/>}/><Route path="*" element={<Landing/>}/></Routes>}
