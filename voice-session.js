/* Agenda Comunicaciones 1.1.1 · sesión de voz prolongada */
(function(global){
'use strict';
function compact(text=''){return String(text).replace(/\s+/g,' ').trim();}
function create(options={}){
  const Recognition=options.Recognition;
  const lang=options.lang||'es-CL';
  const maxMs=Math.max(15000,Number(options.maxMs)||120000);
  const restartDelay=Math.max(100,Number(options.restartDelay)||260);
  const finishGraceMs=Math.max(180,Number(options.finishGraceMs)||520);
  const onState=typeof options.onState==='function'?options.onState:()=>{};
  const onTranscript=typeof options.onTranscript==='function'?options.onTranscript:()=>{};
  const onTick=typeof options.onTick==='function'?options.onTick:()=>{};
  const onDone=typeof options.onDone==='function'?options.onDone:()=>{};
  const onError=typeof options.onError==='function'?options.onError:()=>{};

  let recognition=null,active=false,finishing=false,startedAt=0,lastState='idle',finishReason='manual';
  let maxTimer=0,tickTimer=0,restartTimer=0,finishTimer=0;
  let finalParts=[],interim='';

  const setState=(state,detail='')=>{lastState=state;onState(state,detail);};
  const clearTimer=id=>{if(id)clearTimeout(id);};
  const clearAll=()=>{clearTimer(maxTimer);clearTimer(restartTimer);clearTimer(finishTimer);if(tickTimer)clearInterval(tickTimer);maxTimer=restartTimer=finishTimer=tickTimer=0;};
  const finalText=()=>compact(finalParts.join(' '));
  const combinedText=()=>compact([finalText(),interim].filter(Boolean).join(' '));
  const emit=()=>onTranscript(combinedText(),{finalText:finalText(),interimText:compact(interim)});
  const pushFinal=value=>{const part=compact(value);if(!part)return;const prev=finalParts[finalParts.length-1]||'';if(prev.toLocaleLowerCase('es')===part.toLocaleLowerCase('es'))return;finalParts.push(part);};
  const errorMessage=code=>({
    'not-allowed':'Permiso de voz bloqueado. Autorice el micrófono y vuelva a intentarlo.',
    'service-not-allowed':'El servicio de reconocimiento de voz no está disponible en este navegador.',
    'audio-capture':'No fue posible acceder al micrófono.',
    'network':'El reconocimiento de voz perdió la conexión.',
    'language-not-supported':'El reconocimiento de voz no admite español en este dispositivo.'
  }[code]||'No fue posible continuar con el reconocimiento de voz.');

  const fatal=(message,code='error')=>{
    active=false;finishing=false;clearAll();
    try{recognition?.abort?.();}catch(_){}
    recognition=null;setState('error',code);onError(message,code);
  };

  const completeFinish=()=>{
    clearTimer(finishTimer);finishTimer=0;
    if(!finishing)return;
    if(interim){pushFinal(interim);interim='';emit();}
    const text=combinedText();
    finishing=false;active=false;recognition=null;
    if(!text){setState('error','empty');onError('No alcancé a registrar palabras. Mantenga pulsado e intente nuevamente.','empty');return false;}
    finalParts=[text];interim='';emit();setState('idle',finishReason);onDone(text,finishReason);return true;
  };

  const scheduleRestart=()=>{
    if(!active||finishing)return;
    clearTimer(restartTimer);setState('restarting');
    restartTimer=setTimeout(()=>startRecognizer(),restartDelay);
  };

  const startRecognizer=()=>{
    if(!active||finishing)return;
    if(!Recognition){fatal('El reconocimiento de voz no está disponible en este navegador.','unsupported');return;}
    try{
      const current=new Recognition();recognition=current;
      current.lang=lang;current.continuous=true;current.interimResults=true;current.maxAlternatives=1;
      current.onstart=()=>{if(current!==recognition||(!active&& !finishing))return;setState('listening');};
      current.onresult=event=>{
        if(current!==recognition||(!active&&!finishing))return;
        let interimParts=[];const start=Number.isInteger(event.resultIndex)?event.resultIndex:0;
        for(let i=start;i<(event.results?.length||0);i++){
          const result=event.results[i],text=compact(result?.[0]?.transcript||'');if(!text)continue;
          if(result.isFinal)pushFinal(text);else interimParts.push(text);
        }
        interim=compact(interimParts.join(' '));emit();
      };
      current.onerror=event=>{
        if(current!==recognition)return;const code=event?.error||'error';
        if(finishing&&(code==='aborted'||code==='no-speech'))return;
        if(!active)return;
        if(code==='aborted')return;
        if(code==='no-speech'){setState('waiting','no-speech');return;}
        fatal(errorMessage(code),code);
      };
      current.onend=()=>{
        if(current!==recognition)return;
        if(interim){pushFinal(interim);interim='';emit();}
        recognition=null;
        if(finishing){completeFinish();return;}
        if(active)scheduleRestart();
      };
      current.start();
    }catch(error){recognition=null;if(finishing){completeFinish();return;}if(active)scheduleRestart();}
  };

  const start=()=>{
    if(active||finishing)return false;
    if(!Recognition){onError('El reconocimiento de voz no está disponible en este navegador.','unsupported');return false;}
    clearAll();finalParts=[];interim='';finishing=false;active=true;startedAt=Date.now();finishReason='manual';
    setState('starting');emit();onTick(0,maxMs);
    tickTimer=setInterval(()=>{if(active)onTick(Math.min(Date.now()-startedAt,maxMs),maxMs);},250);
    maxTimer=setTimeout(()=>finish('timeout'),maxMs);startRecognizer();return true;
  };

  const finish=(reason='manual')=>{
    if(finishing)return false;
    if(!active&&lastState!=='error')return false;
    finishing=true;active=false;finishReason=reason;
    clearTimer(maxTimer);maxTimer=0;clearTimer(restartTimer);restartTimer=0;if(tickTimer){clearInterval(tickTimer);tickTimer=0;}
    setState('processing',reason);
    const current=recognition;
    if(current){
      try{current.stop();}catch(_){try{current.abort();}catch(__){}}
      finishTimer=setTimeout(completeFinish,finishGraceMs);
    }else finishTimer=setTimeout(completeFinish,60);
    return true;
  };

  const cancel=()=>{
    if(!active&&!finishing&&lastState==='idle')return;
    active=false;finishing=false;clearAll();
    try{recognition?.abort?.();}catch(_){}
    recognition=null;interim='';setState('idle','cancel');
  };

  return {start,finish,cancel,isActive:()=>active,isFinishing:()=>finishing,getTranscript:()=>combinedText(),getState:()=>lastState,getElapsed:()=>startedAt?Math.max(0,Date.now()-startedAt):0};
}
global.AgendaLongVoiceSession={create};
})(typeof window!=='undefined'?window:globalThis);
