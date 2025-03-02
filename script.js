/** 
 * Version 0.1 (Konzentration auf Heizung)
 * 
 * Ermöglicht die Steuerung der Wärmepumpe mit ioBroker und versicht die Verdichterstarts zu minimieren.
 * 
 * ACHTUNG: 
 * Das ersetzt nicht die Einstellung der Heizkurve der Wärmepumpe. 
 * Um zu viele Starts zu minimieren sollte die Hystese und Heizkurve richtig eingestellt werden.
 * 
 * Licence: MIT
 * Author: florian.feuerpfeil@gmx.de
 * 
 * Das Script wurde im Winter geschrieben und muss bezüglich Warmwasser im Sommer angepasst werden.
 */

const configHeaterAuto=[];
/**
 * TIMESTAMPS
 */
/** Letzte automatische Änderung Timestamp */
configHeaterAuto["lastAuto_change"]='0_userdata.0.Wärmepumpe.auto.lastchange';
/** Minimum Zeit zwischen den Änderungen (Verhinderung von zu vielen Starts) */
configHeaterAuto["minAuto_change"]='0_userdata.0.Wärmepumpe.auto.timeBetweenChanges';

/**
 * WECHSELRICHTER
 */
/** Wechselrichterleistung */
configHeaterAuto["pvActivePower"]='0_userdata.0.Wechselrichter.Wirkleistung_momentan';
/** Minimale Wechselrichterleistung bevor Heizung gestartet wird */
configHeaterAuto["pvMinHeaterPower"]='0_userdata.0.Wärmepumpe.auto.pv_min';

/**
 * HEIZUNG
 */
/** Aktive Programm-Nummer Heizung 1-X */
configHeaterAuto["heaterProgrammActive"]='0_userdata.0.Wärmepumpe.auto.programm.heaterActive';
/** Heizprogramm. Das "Programm + Nummer des aktiven" wird ausgewählt (bei active=1 also den State auf: 0_userdata.0.Wärmepumpe.auto.prog1 )
 *  {"0":[{"on": "5:30","off": "20:00","temp": true,"pv": true,"allways": false}]}
 *  0 = Sonntag, 1=Montag, ..... 6=Samstag
 *  in den [] können mehrere Programme sein
 *  temp => true=Temperatursteuerung an
 *  pv => true=Wirkleistung wird berücksichtigt
 *  allways => alles ignorieren und nach Zeitsteuerung arbeiten
*/
configHeaterAuto["heaterProgramm"]='0_userdata.0.Wärmepumpe.auto.programm.heater';
/** Raumtemperatur */
configHeaterAuto["temperatureInside"]='shelly.0.shellyplusht#d4d4da7cdcd4#1.Temperature0.Celsius';
/** Außentemperatur */
configHeaterAuto["temperatureOutside"]='wolf-smartset.0.Benutzer.Heizung.210_Wärmeerzeuger_1.27000500001';
/** Sommermodus */
configHeaterAuto["isSummerMode"]='0_userdata.0.Wärmepumpe.auto.isSummerMode';
/** Sommermodus an (an und aus sollte ein paar Grad auseinander liegen um ständige Wechsel zu vermeiden */
configHeaterAuto["summerModeON"] = 20;
/** Sommermodus aus */
configHeaterAuto["summerModeOFF"] = 16;
/** Schalter Heizung (An/Aus) */
configHeaterAuto["heaterSwitch"]='wolf-smartset.0.Benutzer.Heizung.030_Gemeinsame_Einstellungen.34002900000';
/** Schalterwert für AUS */
configHeaterAuto["heaterSwitchOFF"]=0;
/** Schalterwert für AN */
configHeaterAuto["heaterSwitchON"]=2;
/** Maximale Innentemperatur damit Heizung aus geht auch wenn Programm AN ist */
//const state_heizung_maxTemperatur ='0_userdata.0.Wärmepumpe.auto.maxMidTempHT'
/** Minimale Innentemperatur. Wenn unterschritten geht Heizung nicht aus. Wenn überschritten geht heizung nicht an. Beides unabhängig vom Programm. */
configHeaterAuto["minInsideTemperature"] ='0_userdata.0.Wärmepumpe.auto.minMidTempHT';
/** Bei der Innentemperatur geht die Heizung immer an. Unabhängig vom Programm */
configHeaterAuto["minInsideTemperatureAutostart"]='0_userdata.0.Wärmepumpe.auto.minTempAutostart';
/** Log für Heizung Letzte Aktion wird gespeichert */
configHeaterAuto["heaterLog"]='0_userdata.0.Wärmepumpe.auto.logHeater';

/**
 * WARMWASSER
 */
/** Aktive Programm-Nummer Wasser 1-X */
configHeaterAuto["waterProgrammActive"]='0_userdata.0.Wärmepumpe.auto.programm.waterActive';
/** Heizprogramm. Das "Programm + Nummer des aktiven" wird ausgewählt (bei active=1 also den State auf: 0_userdata.0.Wärmepumpe.auto.prog1 )
 *  {"0":[{"on": "5:30","off": "20:00"}]}
 *  0 = Sonntag, 1=Montag, ..... 6=Samstag
 *  in den [] können mehrere Programme sein
*/
configHeaterAuto["waterProgramm"]='0_userdata.0.Wärmepumpe.auto.programm.water';
/** Minimum PV-Leistung um Switch für Warmwasser auf Heiß zu stellen */
configHeaterAuto["pvMinHotWaterPower"]='0_userdata.0.Wärmepumpe.auto.pv_minHotWater';
/** Schalter für Heißwasserladung */
configHeaterAuto["switchHotWater"]='wolf-smartset.0.Benutzer.Warmwasser.250_Warmwasser.22004200000';
/** Schalter Warmwasser (An/Aus) */
configHeaterAuto["waterSwitch"]='wolf-smartset.0.Benutzer.Warmwasser.030_Gemeinsame_Einstellungen.35001200000';
/** Schalterwert für AUS */
configHeaterAuto["waterSwitchOFF"]=0;
/** Schalterwert für AN */
configHeaterAuto["waterSwitchON"]=2;
/** Log für Wasser Letzte Aktion wird gespeichert */
configHeaterAuto["waterLog"]='0_userdata.0.Wärmepumpe.auto.logWater';

/**
 * OTHER
 */
configHeaterAuto["partyMode"]='0_userdata.0.Wärmepumpe.auto.partyMode';


/**
 * KEINE ÄNDERUNG AB HIER
 */

schedule('* * * * *', async () => {
    if(!isTimeToChange())return;
    let partyMode = configHeaterAuto["partyMode"]?getState(configHeaterAuto["partyMode"]).val:false;

    if(partyMode){
        setLastAutochange();
        setState(configHeaterAuto["heaterSwitch"], configHeaterAuto["heaterSwitchON"], false);
        setState(configHeaterAuto["waterSwitch"], configHeaterAuto["waterSwitchON"], false);  
        setState(configHeaterAuto["heaterLog"], 3, true); 
        return;
    }
    handleWater();
    handleHeater();
});
/** Warmwasser steuern */
function handleWater(){
    let progActiveNumber = getState(configHeaterAuto["waterProgrammActive"]).val;
    let prog = getState(configHeaterAuto["waterProgramm"]+progActiveNumber).val;
    let switchWater = getState(configHeaterAuto["waterSwitch"]).val;

    try{
        prog=JSON.parse(prog);
        
        const date = new Date();
        const day = date.getDay();
        if(prog[day]&&Array.isArray(prog[day])){
            let isActive=false;
            Object.values(prog[day]).forEach(v=>{
                if(isActive)return;
                if(v["on"]&&v["off"]){
                    let [hours, minutes] = v["on"].split(":");
                    const onDate = new Date();
                    onDate.setHours(hours, minutes, 0);
                    [hours, minutes] = v["off"].split(":");
                    const offDate = new Date();
                    offDate.setHours(hours, minutes, 0);
                    if(date>=onDate&&date<=offDate)isActive=true;
                }
            });            
            if(isActive){
                /**
                 * Programm ist an
                 */
                let minPV = getState(configHeaterAuto["pvMinHeaterPower"]).val;
                let minHotWaterPV = getState(configHeaterAuto["pvMinHotWaterPower"]).val;
                let wirkleistung = getState(configHeaterAuto["pvActivePower"]).val;

                if(minHotWaterPV<wirkleistung&&getState(configHeaterAuto["switchHotWater"]).val==0){
                    setState(configHeaterAuto["switchHotWater"], 1, false);
                    console.log("Einmalladung Warmwasser eingeschaltet");
                }
                if(switchWater==configHeaterAuto["waterSwitchON"]){console.log("Warmwasser schon an. Script wird beendet.");return;}
                //if(progAllways){
                    setLastAutochange();
                    setState(configHeaterAuto["waterSwitch"], configHeaterAuto["waterSwitchON"], false);
                    setState(configHeaterAuto["waterLog"], 1, true);
                    console.log("Warmwasser planmäßig angeschaltet");
                //}
            } else {
                /** 
                 * Programm ist aus
                 */

                if(switchWater==configHeaterAuto["waterSwitchOFF"]){console.log("Warmwasser nicht an. Script wird beendet.");return;}
                setLastAutochange();
                setState(configHeaterAuto["waterSwitch"], configHeaterAuto["waterSwitchOFF"], false);
                setState(configHeaterAuto["waterLog"], 0, true);  
            }
        } else {
            console.error("Kein Wasser-Programm gefunden!");
        }
    } catch(error){
        console.error(error.message);
    }
}
/** Heizung steuern */
function handleHeater(){
    let progActiveNumber = getState(configHeaterAuto["heaterProgrammActive"]).val;
    let prog = getState(configHeaterAuto["heaterProgramm"]+progActiveNumber).val;
    let switchHeater = getState(configHeaterAuto["heaterSwitch"]).val;
    let tempOutside = getState(configHeaterAuto["temperatureOutside"]).val;
    let summerMode = getState(configHeaterAuto["isSummerMode"]).val;
    if(tempOutside>configHeaterAuto["summerModeON"]&&!summerMode){
        summerMode=true;
        setState(configHeaterAuto["isSummerMode"],true,true);
        console.log("Sommermodus angeschaltet");
    } else if(tempOutside<configHeaterAuto["summerModeOFF"]&&summerMode){
        summerMode=false;
        setState(configHeaterAuto["isSummerMode"],false,true);
        console.log("Sommermodus ausgeschaltet");
    }
    if(summerMode){
        if(switchHeater!=configHeaterAuto["heaterSwitchOFF"]){
            setLastAutochange();
            setState(configHeaterAuto["heaterSwitch"], configHeaterAuto["heaterSwitchOFF"], false);
            setState(configHeaterAuto["heaterLog"], 3, true);
            console.log("Sommermodus heizung ausgeschaltet.");
        }        
        return;
    }
    try{
        prog=JSON.parse(prog);
        let tempInside = getState(configHeaterAuto["temperatureInside"]).val;
        let minMidTemp = getState(configHeaterAuto["minInsideTemperature"]).val;
        const date = new Date();
        const day = date.getDay();
        if(prog[day]&&Array.isArray(prog[day])){
            let isActive=false;
            let progTemp=false;
            let progPV=false;
            let progAllways=false;
            Object.values(prog[day]).forEach(v=>{
                if(isActive)return;
                if(v["on"]&&v["off"]){
                    let [hours, minutes] = v["on"].split(":");
                    const onDate = new Date();
                    onDate.setHours(hours, minutes, 0);
                    [hours, minutes] = v["off"].split(":");
                    const offDate = new Date();
                    offDate.setHours(hours, minutes, 0);
                    if(date>=onDate&&date<=offDate)isActive=true;
                    if(v["temp"])progTemp=v["temp"];
                    if(v["pv"])progPV=v["pv"];
                    if(v["allways"])progAllways=v["allways"];
                }
            });            
            if(isActive){
                /**
                 * Programm ist an
                 */
                let minPV = getState(configHeaterAuto["pvMinHeaterPower"]).val;
                let wirkleistung = getState(configHeaterAuto["pvActivePower"]).val;
                if(switchHeater==configHeaterAuto["heaterSwitchON"]){console.log("Heizung schon an. Script wird beendet.");return;}
                if((progAllways||(progTemp&&(tempInside<=minMidTemp))||(progPV&&(minPV<=wirkleistung)))){
                    setLastAutochange();
                    setState(configHeaterAuto["heaterSwitch"], configHeaterAuto["heaterSwitchON"], false);
                    setState(configHeaterAuto["heaterLog"], 1, true);
                    console.log("Heizung planmäßig angeschaltet");
                }
            } else {
                /** 
                 * Programm ist aus
                 */

                let minTempA = getState(configHeaterAuto["minInsideTemperatureAutostart"]).val;
                if(tempInside<minTempA){
                    setLastAutochange();
                    setState(configHeaterAuto["heaterSwitch"], configHeaterAuto["heaterSwitchON"], false);  
                    setState(configHeaterAuto["heaterLog"], 2, true);    
                } else {
                    if(tempInside<minMidTemp){console.log("Raumtemperatur zum Ausschalten zu gering.");return;}
                    if(switchHeater==configHeaterAuto["heaterSwitchOFF"]){console.log("Heizung nicht an. Script wird beendet.");return;}
                    setLastAutochange();
                    setState(configHeaterAuto["heaterSwitch"], configHeaterAuto["heaterSwitchOFF"], false);
                    setState(configHeaterAuto["heaterLog"], 0, true);  
                }
            }
        } else {
            console.error("Kein Heizungs-Programm gefunden!");
        }
    } catch(error){
        console.error(error.message);
    }
}
/** Prüfen ob Zeit zwischen letzter Änderung und minimaler nächster Zeit erreicht ist */
function isTimeToChange(){
    let lastChange = getState(configHeaterAuto["lastAuto_change"]).val;
    let timeBetween = getState(configHeaterAuto["minAuto_change"]).val;
    if(lastChange + (timeBetween*60000) /* nextChange */>new Date().getTime())return false;
    return true;
}
function setLastAutochange(){
    setState(configHeaterAuto["lastAuto_change"], new Date().getTime(), true);
}
