"use client"
import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useMutation } from 'convex/react'
import { api } from '@/convex/_generated/api'
import ApptTypeManager from './ApptTypeManager'
import Scheduler from './Scheduler'
import AdvancedScheduler from './AdvancedScheduler'
import TemplateManager from './TemplateManager'
import ClinicEhrWorkspace from './ClinicEhrWorkspace'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export default function ClinicShell({clinicName}:{clinicName:string}){
  const [tab,setTab] = useState<'PM'|'EHR'|'Scheduler'>('PM')
  const clinicId = useMemo(() => clinicName.replace(/\s+/g,'_'), [clinicName])
  const ensureDefaults = useMutation(api.primaryCare.ensurePrimaryCareDefaults)
  const seededRef = useRef(false)
  const [advanced, setAdvanced] = useState(false)
  useEffect(()=>{
    try{
      const key = `clinic:advanced:${clinicId}`;
      const stored = typeof window !== 'undefined' ? window.localStorage.getItem(key) : null;
      if(stored===null) return;
      setAdvanced(stored === '1');
    }catch{}
  },[clinicId]);

  useEffect(()=>{
    try{
      const key = `clinic:advanced:${clinicId}`;
      if(typeof window === 'undefined') return;
      window.localStorage.setItem(key, advanced ? '1' : '0');
    }catch{}
  },[advanced, clinicId]);

  useEffect(() => {
    if (seededRef.current) return
    seededRef.current = true
    void ensureDefaults({ clinicId })
  }, [clinicId, ensureDefaults])

  return (
    <Card className="mt-6 border-slate-200 shadow-lg">
      <CardHeader className="border-b bg-slate-50/70">
        <CardTitle className="text-2xl font-black tracking-tight">{clinicName}</CardTitle>
        <div className="text-sm text-muted-foreground">Practice management, EHR templates, scheduling, and room setup.</div>
      </CardHeader>
      <CardContent className="space-y-4 pt-6">
        <div className="flex flex-wrap gap-2">
          <Button variant={tab==='PM'?'default':'outline'} onClick={()=>setTab('PM')} aria-pressed={tab==='PM'}>PM</Button>
          <Button variant={tab==='EHR'?'default':'outline'} onClick={()=>setTab('EHR')} aria-pressed={tab==='EHR'}>EHR</Button>
          <Button variant={tab==='Scheduler'?'default':'outline'} onClick={()=>setTab('Scheduler')} aria-pressed={tab==='Scheduler'}>Scheduler</Button>
        </div>

        {tab==='PM' && (
          <div className="space-y-4">
            <div>
              <h2 className="text-lg font-semibold">Practice Management</h2>
              <p className="text-sm text-muted-foreground">Manage appointment types and front-desk workflows.</p>
            </div>
            <ApptTypeManager storageKeyPrefix={clinicId} />
          </div>
        )}

        {tab==='EHR' && (
          <div className="space-y-4">
            <div>
              <h2 className="text-lg font-semibold">Electronic Health Record</h2>
              <p className="text-sm text-muted-foreground">Start with a default SOAP template, then edit and expand it.</p>
            </div>
            {advanced ? <ClinicEhrWorkspace storageKeyPrefix={clinicId} /> : <TemplateManager storageKeyPrefix={clinicId} />}
          </div>
        )}

        {tab==='Scheduler' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold">Scheduler</h2>
                <p className="text-sm text-muted-foreground">Create, move, edit, and delete appointments with room and provider awareness.</p>
              </div>
              <div className="flex gap-2">
                <Button onClick={()=>setAdvanced((s)=>!s)} variant="outline">{advanced? 'Classic View' : 'Advanced View'}</Button>
              </div>
            </div>
            {advanced ? <AdvancedScheduler storageKeyPrefix={clinicId} /> : <Scheduler storageKeyPrefix={clinicId} />}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
