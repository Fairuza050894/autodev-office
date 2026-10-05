'use client';
import { useEffect, useState } from 'react';
import { animate, useReducedMotion } from 'framer-motion';
export default function Metric({value}:{value:string|number|undefined}) { const [display,setDisplay]=useState(typeof value==='number'?0:value);const reduced=useReducedMotion();useEffect(()=>{if(typeof value!=='number'||reduced){setDisplay(value);return;}const animation=animate(0,value,{duration:.7,onUpdate:current=>setDisplay(Math.round(current*100)/100)});return()=>animation.stop();},[value,reduced]);return <strong>{display??'—'}</strong>; }
