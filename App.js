
import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, FlatList, StyleSheet, Modal, TextInput, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';

export default function App() {
  const [firebaseUrl, setFirebaseUrl] = useState('https://swingtrade-8bda4-default-rtdb.firebaseio.com');
  const [savedUrl, setSavedUrl] = useState(null);
  const [trades, setTrades] = useState([]);
  const [totalAtual, setTotalAtual] = useState(0);
  const [totalInvestido, setTotalInvestido] = useState(0);
  const [lucroTotal, setLucroTotal] = useState(0);
  const [timestamp, setTimestamp] = useState('');
  const [showConfig, setShowConfig] = useState(false);
  const [tempUrl, setTempUrl] = useState('');
  const intervalRef = useRef(null);
  const lastDadosRef = useRef('');

  useEffect(() => {
    init();
    // demo inicial igual web
    const demo = parseLista("VALE3 100 78.0 78.95 C 650.20; VALEU771 500 0.75 0.62 V 0.00");
    if(demo.length>0){
      setTrades(demo);
      setTotalInvestido(demo.reduce((s,t)=>s+t.qtd*t.entrada,0));
      setTotalAtual(demo.reduce((s,t)=>s+t.qtd*t.atual,0));
      setLucroTotal(demo.reduce((s,t)=>s+calcLucro(t),0));
      setTimestamp(new Date().toLocaleString('pt-BR'));
    }
    return () => clearInterval(intervalRef.current);
  }, []);

  const init = async () => {
    const url = await AsyncStorage.getItem('FIREBASE_URL');
    if(url){
      setSavedUrl(url);
      setFirebaseUrl(url);
      setTempUrl(url);
      startPolling(url);
    }
  };

  const saveUrl = async () => {
    const url = (tempUrl || firebaseUrl).trim().replace(/\/$/, '');
    if(!url.includes('firebaseio.com')){ Alert.alert('URL inválida'); return; }
    await AsyncStorage.setItem('FIREBASE_URL', url);
    setSavedUrl(url);
    setFirebaseUrl(url);
    setShowConfig(false);
    Alert.alert('Salvo','Conectado! Atualiza a cada 3s');
    startPolling(url);
  };

  const parseLista = (msg) => {
    try{
      const items = msg.trim().split(';');
      const res=[];
      for(let s of items){
        const p=s.trim().toUpperCase().replace(/,/g,'.').split(/\s+/);
        if(p.length<4) continue;
        const ticker=p[0];
        const qtd=parseInt(p[1]);
        const entrada=parseFloat(p[2]);
        const atual=parseFloat(p[3]);
        let tipo='C';
        let lucroMax=0;
        if(p.length>=5){
          if(p[4]==='V'||p[4]==='C'){ tipo=p[4]; if(p.length>=6) lucroMax=parseFloat(p[5])||0; }
          else { lucroMax=parseFloat(p[4])||0; }
        }
        if(isNaN(qtd)||isNaN(entrada)||isNaN(atual)) continue;
        res.push({ticker,qtd,entrada,atual,tipo,lucroMax});
      }
      return res;
    }catch(e){ return []; }
  };

  const calcLucro = (item) => item.tipo==='V' ? (item.entrada-item.atual)*item.qtd : (item.atual-item.entrada)*item.qtd;

  const startPolling = (baseUrl) => {
    clearInterval(intervalRef.current);
    const finalUrl = baseUrl.replace(/\/$/, '') + '/carteira.json';
    const poll = async () => {
      try{
        const r = await fetch(finalUrl + '?t=' + Date.now(), {cache:'no-store'});
        const data = await r.json();
        if(data && data.dados && data.dados !== lastDadosRef.current){
          lastDadosRef.current = data.dados;
          const lista = parseLista(data.dados);
          if(lista.length>0){
            setTrades(lista);
            setTotalInvestido(lista.reduce((s,t)=>s+t.qtd*t.entrada,0));
            setTotalAtual(lista.reduce((s,t)=>s+t.qtd*t.atual,0));
            setLucroTotal(lista.reduce((s,t)=>s+calcLucro(t),0));
            setTimestamp(data.timestamp ? new Date(data.timestamp).toLocaleString('pt-BR') : new Date().toLocaleString('pt-BR'));
          }
        }
      }catch(e){}
    };
    poll();
    intervalRef.current = setInterval(poll,3000);
  };

  const renderItem = ({item}) => {
    const lucro = calcLucro(item);
    const perc = item.entrada!==0 ? (lucro/(item.entrada*Math.abs(item.qtd)))*100 : 0;
    const isV = item.tipo==='V';
    const isLucro = lucro>=0;
    // LOGICA EXATA PEDIDA: TAG laranja se lucro atual 25% menor que lucro total/max
    const showTag = item.lucroMax>0 && lucro < (item.lucroMax * 0.75);
    const queda = item.lucroMax>0 ? ((item.lucroMax - lucro)/item.lucroMax*100) : 0;
    return (
      <View style={styles.card}>
        <View style={[styles.icon, {backgroundColor: isV ? '#FF9500' : '#1A9A8C'}]}><Text style={styles.iconText}>{isV ? '↘' : '↗'}</Text></View>
        <View style={{flex:1}}>
          <View style={{flexDirection:'row', alignItems:'center'}}>
            <Text style={styles.ticker}>{item.ticker}</Text>
            <View style={[styles.badge, {backgroundColor: isV ? '#FF9500' : '#2BB2A6'}]}><Text style={styles.badgeText}>{item.tipo}</Text></View>
          </View>
          <Text style={styles.qtd}>{item.qtd} Qtd • {isV?'Vendido':'Comprado'} R$ {item.entrada.toFixed(2)} → R$ {item.atual.toFixed(2)}</Text>
          <View style={{flexDirection:'row', alignItems:'center', marginTop:2}}>
            <Text style={styles.lucroMax}>lucro Max R$ {item.lucroMax.toFixed(2).replace('.',',')}</Text>
            {showTag ? <View style={styles.tag}><Text style={styles.tagText}>↓ -{queda.toFixed(0)}%</Text></View> : null}
          </View>
        </View>
        <View style={{alignItems:'flex-end'}}>
          <Text style={styles.total}>R$ {(item.qtd*item.atual).toFixed(2).replace('.',',')}</Text>
          <Text style={[styles.lucro, {color: isLucro ? '#30D158' : '#FF3B30'}]}>{isLucro?'↗ ▲':'↘ ▼'} R$ {Math.abs(lucro).toFixed(2).replace('.',',')}</Text>
          <Text style={[styles.perc, {color: isLucro ? '#30D158' : '#FF3B30'}]}>({perc>=0?'+':''}{perc.toFixed(2).replace('.',',')}%)</Text>
        </View>
      </View>
    );
  };

  const percTotal = totalInvestido!==0 ? (lucroTotal/totalInvestido)*100 : 0;

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />
      <View style={styles.header}>
        <Text style={styles.title}>Swing Trade</Text>
        <View style={{flexDirection:'row', alignItems:'center'}}>
          <View style={styles.ao}><View style={styles.dot}/><Text style={styles.aoText}>AO VIVO</Text></View>
          <TouchableOpacity style={styles.gear} onPress={()=>{ setTempUrl(savedUrl||firebaseUrl); setShowConfig(true); }}><Text>⚙️</Text></TouchableOpacity>
        </View>
      </View>
      <View style={styles.totalCard}>
        <Text style={styles.label}>Total da Carteira</Text>
        <View style={styles.row}><Text style={styles.rowLabel}>Total Atual</Text><Text style={styles.big}>R$ {totalAtual.toFixed(2).replace('.',',')}</Text></View>
        <View style={styles.row}><Text style={styles.rowLabel}>Investido</Text><Text style={styles.mid}>R$ {totalInvestido.toFixed(2).replace('.',',')}</Text></View>
        <View style={styles.divider}/>
        <View style={styles.row}><Text style={styles.rowLabel}>Lucro / Prejuízo</Text><Text style={[styles.lucroTotal, {color: lucroTotal>=0 ? '#30D158' : '#FF3B30'}]}>{lucroTotal>=0?'+':''}R$ {lucroTotal.toFixed(2).replace('.',',')} ({percTotal>=0?'+':''}{percTotal.toFixed(2).replace('.',',')}%)</Text></View>
        <Text style={styles.time}>{timestamp}</Text>
      </View>
      <FlatList data={trades} keyExtractor={(i,idx)=>i.ticker+idx} renderItem={renderItem} />
      <Text style={styles.formato}>TAG laranja se lucro atual 25% menor que Max (lucro {'<'} Max*0.75)</Text>
      <Modal visible={showConfig} transparent animationType="slide">
        <View style={styles.modalBg}><View style={styles.modalBox}>
          <Text style={styles.modalTitle}>Configurar Firebase</Text>
          <TextInput style={styles.input} value={tempUrl} onChangeText={setTempUrl} placeholder="https://...firebaseio.com" autoCapitalize="none" />
          <TouchableOpacity style={[styles.btn, {backgroundColor:'#1A9A8C'}]} onPress={saveUrl}><Text style={styles.btnText}>Salvar e Conectar</Text></TouchableOpacity>
          <TouchableOpacity style={[styles.btn, {backgroundColor:'#F2F2F7'}]} onPress={()=>setShowConfig(false)}><Text style={[styles.btnText,{color:'#333'}]}>Cancelar</Text></TouchableOpacity>
        </View></View>
      </Modal>
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({
  container:{flex:1, backgroundColor:'#fff'},
  header:{flexDirection:'row', justifyContent:'space-between', alignItems:'center', padding:16},
  title:{fontSize:22, fontWeight:'800'},
  ao:{flexDirection:'row', alignItems:'center', marginRight:8},
  dot:{width:10, height:10, borderRadius:5, backgroundColor:'#22C55E', marginRight:6},
  aoText:{color:'#16A34A', fontSize:13, fontWeight:'700'},
  gear:{width:36, height:36, borderRadius:18, backgroundColor:'#F2F2F7', justifyContent:'center', alignItems:'center'},
  totalCard:{backgroundColor:'#1C1C1E', borderRadius:24, margin:16, padding:20},
  label:{color:'#8E8E93', fontSize:13},
  row:{flexDirection:'row', justifyContent:'space-between', alignItems:'center', marginTop:12},
  rowLabel:{color:'#8E8E93', fontSize:15},
  big:{color:'#fff', fontSize:28, fontWeight:'800'},
  mid:{color:'#AEAEB2', fontSize:16},
  divider:{height:1, backgroundColor:'#2C2C2E', marginVertical:16},
  lucroTotal:{fontSize:17, fontWeight:'700'},
  time:{color:'#636366', fontSize:11, textAlign:'right', marginTop:14},
  card:{backgroundColor:'#F2F2F7', borderRadius:20, marginHorizontal:16, marginBottom:12, padding:16, flexDirection:'row', alignItems:'center'},
  icon:{width:56, height:56, borderRadius:16, justifyContent:'center', alignItems:'center', marginRight:12},
  iconText:{color:'#fff', fontSize:24, fontWeight:'800'},
  ticker:{fontSize:18, fontWeight:'800'},
  badge:{marginLeft:6, paddingHorizontal:6, paddingVertical:2, borderRadius:6},
  badgeText:{color:'#fff', fontSize:11, fontWeight:'700'},
  qtd:{color:'#8E8E93', fontSize:13, marginTop:3},
  lucroMax:{color:'#30D158', fontSize:13, marginTop:2},
  tag:{backgroundColor:'#FF9500', paddingHorizontal:8, paddingVertical:3, borderRadius:999, marginLeft:6},
  tagText:{color:'#fff', fontSize:10, fontWeight:'800'},
  total:{fontSize:17, fontWeight:'800'},
  lucro:{fontSize:13, fontWeight:'700', marginTop:3},
  perc:{fontSize:13, marginTop:2},
  formato:{color:'#AEAEB2', fontSize:11, textAlign:'center', padding:12},
  modalBg:{flex:1, backgroundColor:'rgba(0,0,0,0.4)', justifyContent:'center', padding:24},
  modalBox:{backgroundColor:'#fff', borderRadius:24, padding:24},
  modalTitle:{fontSize:18, fontWeight:'800'},
  input:{borderWidth:1, borderColor:'#ddd', borderRadius:12, padding:12, marginTop:16},
  btn:{padding:14, borderRadius:12, alignItems:'center', marginTop:12},
  btnText:{color:'#fff', fontWeight:'700'}
});
