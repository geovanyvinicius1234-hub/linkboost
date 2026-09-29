require('dotenv').config();

const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');
const crypto = require('crypto');

const PORT = Number(process.env.PORT || 3000);
const ROOT = __dirname;
const DATA = path.join(ROOT, 'data.json');

const initial = {
  settings: {
    postsPerDay: 5,
    times: ['08:00','12:00','16:00','19:00','21:00'],
    affiliateLink: '',
    shopeeConnected: false,
    facebookConnected: false
  },
  groups: [
    {id:'g1',name:'Achadinhos da Shopee',members:'12,4 mil',active:true},
    {id:'g2',name:'Promoções e Descontos',members:'8,7 mil',active:true},
    {id:'g3',name:'Compras Online - Shopee',members:'25,1 mil',active:true},
    {id:'g4',name:'Ofertas do Dia',members:'15,3 mil',active:true}
  ],
  products: [
    {id:'p1',name:'Fone Bluetooth TWS',price:'R$ 49,90',emoji:'🎧',url:'',active:true},
    {id:'p2',name:'Smartwatch',price:'R$ 79,90',emoji:'⌚',url:'',active:true}
  ],
  posts: []
};

function load(){
  if(!fs.existsSync(DATA)) fs.writeFileSync(DATA, JSON.stringify(initial,null,2));
  return JSON.parse(fs.readFileSync(DATA,'utf8'));
}

function save(db){
  fs.writeFileSync(DATA, JSON.stringify(db,null,2));
}

let db=load();

function json(res,status,obj){
  const body=JSON.stringify(obj);
  res.writeHead(status,{
    'Content-Type':'application/json; charset=utf-8',
    'Access-Control-Allow-Origin':'*'
  });
  res.end(body);
}

function body(req){
  return new Promise((resolve,reject)=>{
    let s='';
    req.on('data',c=>s+=c);
    req.on('end',()=>{
      try{
        resolve(s?JSON.parse(s):{});
      }catch(e){
        reject(e);
      }
    });
  });
}

function id(){
  return crypto.randomBytes(5).toString('hex');
}

function parseShopee(link){
  try{
    const u=new URL(String(link||'').trim());
    const parts=u.pathname.split('/').filter(Boolean);

    return {
      host:u.hostname,
      slug:parts.at(-1)||'',
      productId:(parts.find(x=>/^\d{6,}$/.test(x))||'')
    };
  }catch{
    return {
      host:'',
      slug:'',
      productId:''
    };
  }
}

function route(req,res){
  const p=url.parse(req.url,true).pathname;

  if(req.method==='GET' && p==='/api/state'){
    return json(res,200,{
      ...db,
      meta:{
        shopeeApiConfigured:Boolean(
          process.env.SHOPEE_APP_ID &&
          process.env.SHOPEE_SECRET
        ),
        facebookApiConfigured:Boolean(
          process.env.FACEBOOK_APP_ID &&
          process.env.FACEBOOK_APP_SECRET
        )
      }
    });
  }

  if(req.method==='POST' && p==='/api/products'){
    return body(req).then(x=>{
      if(!x.url){
        return json(res,400,{
          error:'Informe o link da Shopee.'
        });
      }

      const parsed=parseShopee(x.url);

      const product={
        id:id(),
        name:x.name||parsed.slug||'Produto Shopee',
        price:x.price||'Preço a confirmar',
        emoji:x.emoji||'🛍️',
        url:x.url,
        productId:parsed.productId,
        active:true,
        createdAt:new Date().toISOString()
      };

      db.products.unshift(product);
      save(db);

      json(res,201,product);
    }).catch(()=>{
      json(res,400,{
        error:'JSON inválido.'
      });
    });
  }

  if(req.method==='DELETE' && p.startsWith('/api/products/')){
    db.products=db.products.filter(
      x=>x.id!==p.split('/').pop()
    );

    save(db);

    return json(res,200,{
      ok:true
    });
  }

  if(req.method==='POST' && p==='/api/groups'){
    return body(req).then(x=>{
      if(!x.name){
        return json(res,400,{
          error:'Informe o nome do grupo.'
        });
      }

      const g={
        id:id(),
        name:x.name,
        members:x.members||'—',
        active:true
      };

      db.groups.push(g);
      save(db);

      json(res,201,g);
    });
  }

  if(req.method==='PATCH' && p.startsWith('/api/groups/')){
    return body(req).then(x=>{
      const g=db.groups.find(
        x=>x.id===p.split('/').pop()
      );

      if(!g){
        return json(res,404,{
          error:'Grupo não encontrado.'
        });
      }

      Object.assign(g,x);
      save(db);

      json(res,200,g);
    });
  }

  if(req.method==='DELETE' && p.startsWith('/api/groups/')){
    db.groups=db.groups.filter(
      x=>x.id!==p.split('/').pop()
    );

    save(db);

    return json(res,200,{
      ok:true
    });
  }

  if(req.method==='POST' && p==='/api/settings'){
    return body(req).then(x=>{
      db.settings={
        ...db.settings,
        ...x
      };

      save(db);

      json(res,200,db.settings);
    });
  }

  if(req.method==='POST' && p==='/api/generate'){
    return body(req).then(x=>{
      const product=db.products.find(
        p=>p.id===x.productId
      );

      if(!product){
        return json(res,404,{
          error:'Produto não encontrado.'
        });
      }

      const templates=[
        `🔥 ACHADINHO DO DIA! ${product.name} por ${product.price}. Dá uma olhada antes que o preço mude 👀🛒\n${product.url||''}`,

        `✨ Olha esse achado: ${product.name}! ${product.price}. Se curtiu, confere o link 👇\n${product.url||''}`,

        `🚨 OFERTA! ${product.name} por ${product.price}. Corre para conferir enquanto está disponível! 🛍️🔥\n${product.url||''}`
      ];

      json(res,200,{
        variants:templates
      });
    });
  }

  if(req.method==='POST' && p==='/api/auto-schedule'){
    return body(req).then(x=>{
      const days=Math.max(
        1,
        Math.min(Number(x.days)||7,14)
      );

      const activeProducts=db.products.filter(
        p=>p.active!==false
      );

      const activeGroups=db.groups.filter(
        g=>g.active!==false
      );

      const times=Array.isArray(db.settings.times)
        ? db.settings.times.filter(Boolean)
        : [];

      const postsPerDay=Math.max(
        1,
        Number(db.settings.postsPerDay)||times.length||1
      );

      if(!activeProducts.length){
        return json(res,400,{
          error:'Nenhum produto ativo.'
        });
      }

      if(!activeGroups.length){
        return json(res,400,{
          error:'Nenhum grupo ativo.'
        });
      }

      if(!times.length){
        return json(res,400,{
          error:'Nenhum horário configurado.'
        });
      }

      const templates=[
        p=>`🔥 ACHADINHO DO DIA! ${p.name} por ${p.price}. Dá uma olhada antes que o preço mude 👀🛒\n${p.url||''}`,

        p=>`✨ Olha esse achado: ${p.name}! ${p.price}. Se curtiu, confere o link 👇\n${p.url||''}`,

        p=>`🚨 OFERTA! ${p.name} por ${p.price}. Corre para conferir enquanto está disponível! 🛍️🔥\n${p.url||''}`
      ];

      const now=new Date();

      let created=0;
      let productIndex=0;
      let groupIndex=0;

      for(let day=0;day<days;day++){
        const date=new Date(now);

        date.setDate(
          date.getDate()+day
        );

        const slots=Math.min(
          postsPerDay,
          times.length
        );

        for(let i=0;i<slots;i++){
          const [h,m]=String(times[i])
            .split(':')
            .map(Number);

          const year=date.getFullYear();

          const month=String(
            date.getMonth()+1
          ).padStart(2,'0');

          const dayNumber=String(
            date.getDate()
          ).padStart(2,'0');

          const scheduledAt=new Date(
            `${year}-${month}-${dayNumber}T${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:00-03:00`
          );

          if(scheduledAt<=now){
            continue;
          }

          const product=
            activeProducts[
              productIndex%activeProducts.length
            ];

          const group=
            activeGroups[
              groupIndex%activeGroups.length
            ];

          const text=
            templates[
              created%templates.length
            ](product);

          const exists=db.posts.some(post=>
            post.productId===product.id &&
            post.groupId===group.id &&
            post.scheduledAt===scheduledAt.toISOString()
          );

          if(!exists){
            db.posts.push({
              id:id(),
              productId:product.id,
              groupId:group.id,
              text,
              scheduledAt:scheduledAt.toISOString(),
              status:'Pendente',
              createdAt:new Date().toISOString()
            });

            created++;
          }

          productIndex++;
          groupIndex++;
        }
      }

      save(db);

      json(res,200,{
        ok:true,
        created,
        total:db.posts.length
      });
    });
  }

  if(req.method==='POST' && p==='/api/posts'){
    return body(req).then(x=>{
      const product=db.products.find(
        p=>p.id===x.productId
      );

      const group=db.groups.find(
        g=>g.id===x.groupId
      );

      if(!product||!group){
        return json(res,400,{
          error:'Produto ou grupo inválido.'
        });
      }

      const post={
        id:id(),
        productId:product.id,
        groupId:group.id,
        text:x.text||'',
        scheduledAt:
          x.scheduledAt||
          new Date().toISOString(),
        status:'Pendente',
        createdAt:new Date().toISOString()
      };

      db.posts.push(post);
      save(db);

      json(res,201,post);
    });
  }

  if(req.method==='PATCH' && p.startsWith('/api/posts/')){
    return body(req).then(x=>{
      const post=db.posts.find(
        q=>q.id===p.split('/').pop()
      );

      if(!post){
        return json(res,404,{
          error:'Post não encontrado.'
        });
      }

      Object.assign(post,x);
      save(db);

      json(res,200,post);
    });
  }

  if(req.method==='DELETE' && p.startsWith('/api/posts/')){
    db.posts=db.posts.filter(
      x=>x.id!==p.split('/').pop()
    );

    save(db);

    return json(res,200,{
      ok:true
    });
  }

  if(req.method==='GET' && p==='/api/health'){
    return json(res,200,{
      ok:true,
      version:'1.0.0'
    });
  }

  if(req.method==='GET'){
    const file=p==='/'?'/index.html':p;
    const fp=path.join(ROOT,file);

    if(
      fp.startsWith(ROOT) &&
      fs.existsSync(fp) &&
      fs.statSync(fp).isFile()
    ){
      const ext=path.extname(fp);

      const types={
        '.html':'text/html; charset=utf-8',
        '.css':'text/css',
        '.js':'application/javascript'
      };

      res.writeHead(200,{
        'Content-Type':
          types[ext]||'text/plain'
      });

      return fs
        .createReadStream(fp)
        .pipe(res);
    }
  }

  json(res,404,{
    error:'Rota não encontrada'
  });
}

http
  .createServer((req,res)=>{
    route(req,res);
  })
  .listen(
    PORT,
    ()=>console.log(
      `LinkBoost V1 em http://localhost:${PORT}`
    )
  );
