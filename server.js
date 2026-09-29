  if(req.method==='POST' && p==='/api/auto-schedule') return body(req).then(x=>{
    const days=Math.max(1,Math.min(Number(x.days)||7,14));
    const activeProducts=db.products.filter(p=>p.active!==false);
    const activeGroups=db.groups.filter(g=>g.active!==false);
    const times=Array.isArray(db.settings.times)?db.settings.times.filter(Boolean):[];
    const postsPerDay=Math.max(1,Number(db.settings.postsPerDay)||times.length||1);

    if(!activeProducts.length)return json(res,400,{error:'Nenhum produto ativo.'});
    if(!activeGroups.length)return json(res,400,{error:'Nenhum grupo ativo.'});
    if(!times.length)return json(res,400,{error:'Nenhum horário configurado.'});

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
      date.setDate(date.getDate()+day);

      const slots=Math.min(postsPerDay,times.length);

      for(let i=0;i<slots;i++){
        const time=times[i];
        const [h,m]=String(time).split(':').map(Number);

        const year=date.getFullYear();
        const month=String(date.getMonth()+1).padStart(2,'0');
        const dayNumber=String(date.getDate()).padStart(2,'0');

        const scheduledAt=new Date(
          `${year}-${month}-${dayNumber}T${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:00-03:00`
        );

        if(scheduledAt<=now)continue;

        const product=activeProducts[productIndex%activeProducts.length];
        const group=activeGroups[groupIndex%activeGroups.length];
        const text=templates[created%templates.length](product);

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
http.createServer((req,res)=>{route(req,res)}).listen(PORT,()=>console.log(`LinkBoost V1 em http://localhost:${PORT}`));
