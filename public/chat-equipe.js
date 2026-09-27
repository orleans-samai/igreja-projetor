/**
 * O chat da equipe nas páginas do celular e do dirigente.
 *
 * Um arquivo só para as duas páginas: elas já tinham, cada uma, uma cópia
 * do desenho do chat, e duas cópias divergem. Aqui moram os balões, as
 * cores, os grupos, as menções, o destino, as fotos, quem está no chat e
 * quem está digitando. A página cuida do que é dela — como falar com a
 * cabine, o aviso dourado, o selo de não lidas.
 *
 * As regras que também valem na cabine (a paleta, a conta da cor, a janela
 * de grupo) são as mesmas de src/lib/cor-do-chat.ts e src/lib/chat-grupos.ts;
 * os testes de lá conferem este arquivo.
 *
 * Sem build: JavaScript que qualquer celular da igreja roda.
 */
(function () {
  "use strict";

  var CORES_DO_CHAT = ["#5cc8f5", "#b39bfa", "#4fd1a1", "#f58bc4", "#fb9d5c", "#3fd6e8", "#b5e35a", "#f78b8b"];
  var JANELA_DO_GRUPO_MS = 5 * 60 * 1000;
  var EQUIPES = { cabine: "Cabine", som: "Som", louvor: "Louvor", pastor: "Pastor" };
  var EQUIPES_DE_APARELHO = ["som", "louvor", "pastor"];
  /** "Digitando…" some sozinho se ninguém disser mais nada. */
  var DIGITANDO_MS = 4000;
  /** Foto reduzida antes de sair do celular: poucas centenas de KB pela Wi-Fi da igreja. */
  var LADO_DA_FOTO = 1600;

  var ESTILO = [
    ".ce-topo{display:flex;flex-wrap:wrap;align-items:center;gap:6px 12px;font-size:12.5px;color:var(--muted,#9aa2ad)}",
    ".ce-presenca{display:flex;flex-wrap:wrap;gap:4px 10px;align-items:center;min-width:0;flex:1}",
    ".ce-pessoa{display:inline-flex;align-items:center;gap:5px;white-space:nowrap}",
    ".ce-ponto{width:8px;height:8px;border-radius:50%;flex:none}",
    ".ce-equipe select,.ce-para select{font:inherit;color:var(--fg,#f1f3f5);background:var(--elevada,#171a1e);border:1px solid var(--borda,#23272e);border-radius:9px;padding:6px 8px;font-size:16px}",
    ".ce-equipe{display:inline-flex;align-items:center;gap:6px}",
    ".ce-linha-msg{display:flex;gap:8px;align-items:flex-end}",
    ".ce-linha-msg.minha{justify-content:flex-end}",
    ".ce-linha-msg.junta{margin-top:-6px}",
    ".ce-avatar{width:28px;height:28px;border-radius:50%;display:grid;place-items:center;font:700 11.5px/1 system-ui,sans-serif;color:#0a0b0d;flex:none}",
    ".ce-avatar.vazio{visibility:hidden}",
    ".ce-balao{max-width:82%;padding:8px 11px;border-radius:15px;background:rgba(255,255,255,.055);border:1px solid var(--borda,#23272e)}",
    ".ce-linha-msg.minha .ce-balao{background:var(--ce-minha,rgba(240,168,48,.13));border-color:var(--ce-minha-borda,rgba(240,168,48,.45))}",
    ".ce-nome{margin:0 0 2px;font-size:12.5px;font-weight:700}",
    ".ce-para-chip{margin:0 0 3px;font-size:11.5px;color:var(--muted,#9aa2ad)}",
    ".ce-texto-msg{margin:0;white-space:pre-wrap;word-break:break-word;font-size:14.5px;user-select:text}",
    ".ce-mencao{font-weight:700}",
    ".ce-mencao.eu{background:rgba(240,168,48,.22);border-radius:4px;padding:0 2px}",
    ".ce-apagada{margin:0;font-style:italic;color:var(--subtle,#6b7280);font-size:13.5px}",
    ".ce-hora{display:block;text-align:right;font-size:11px;color:var(--subtle,#6b7280);margin-top:3px}",
    ".ce-foto-msg{display:block;max-width:100%;max-height:230px;border-radius:10px;margin:2px 0 4px;cursor:zoom-in;background:#000}",
    ".ce-digitando{margin:0;min-height:18px;font-size:12.5px;color:var(--muted,#9aa2ad);font-style:italic}",
    ".ce-sugestoes{display:flex;flex-wrap:wrap;gap:6px}",
    ".ce-sugestoes button{font:inherit;font-size:14px;padding:7px 11px;border-radius:999px;border:1px solid var(--borda,#23272e);background:var(--elevada,#171a1e);color:var(--fg,#f1f3f5)}",
    ".ce-calado{margin:0;font-size:13px;color:var(--perigo,#e5484d)}",
    ".ce-para{display:flex;align-items:center;gap:8px;font-size:13px;color:var(--muted,#9aa2ad)}",
    ".ce-para select{flex:1;min-width:0}",
    ".ce-foto{cursor:pointer}",
    ".ce-lupa{position:fixed;inset:0;z-index:80;background:rgba(0,0,0,.92);display:grid;place-items:center;padding:12px}",
    ".ce-lupa img{max-width:100%;max-height:100%;border-radius:8px}",
    // Sem isto, o display acima venceria o `hidden` numa página que não o
    // reforça — e a lupa preta cobriria a tela inteira.
    ".ce-sugestoes[hidden],.ce-calado[hidden],.ce-lupa[hidden]{display:none}",
  ].join("\n");

  function dobrar(s) {
    return String(s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  }

  /**
   * Sem acento e em minúscula, letra a letra, lembrando de onde veio cada
   * letra: é o que deixa destacar "@João" no texto original depois de achá-lo
   * como "@joao" (a mesma regra de src/lib/chat-grupos.ts).
   */
  function dobrarComOrigem(texto) {
    var alvo = "";
    var origem = [];
    for (var i = 0; i < texto.length; i += 1) {
      var d = dobrar(texto.charAt(i));
      for (var k = 0; k < d.length; k += 1) {
        alvo += d.charAt(k);
        origem.push(i);
      }
    }
    origem.push(texto.length);
    return { alvo: alvo, origem: origem };
  }

  function hora(ms) {
    return new Date(ms).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  }

  /** "Pastor João" → "PJ"; "Bia" → "B" (a mesma regra de src/lib/chat-grupos.ts). */
  function iniciais(nome) {
    var partes = String(nome || "").trim().split(/\s+/).filter(Boolean);
    if (!partes.length) return "?";
    var a = Array.from(partes[0])[0] || "";
    var b = partes.length > 1 ? Array.from(partes[partes.length - 1])[0] || "" : "";
    return (a + b).toUpperCase();
  }

  function chaveDaPessoa(m) {
    return m.daCabine ? "cabine" : "p:" + String(m.de || "").trim().toLowerCase();
  }

  /** Quem escreveu, para agrupar: o id quando existe, senão o nome. */
  function autorDoGrupo(m) {
    if (m.daCabine) return "cabine";
    return m.deId || "nome:" + m.de;
  }

  window.LumenChat = {
    /**
     * Monta o chat sobre os elementos que a página já tem.
     *
     * o.lista, o.form, o.texto, o.enviar — da página; o.erro (opcional).
     * o.classeDoBotao — a classe dos botões da página, para o 📷.
     * o.meuNome() — o nome de quem está aqui (fallback de "minha").
     * o.enviarTexto(texto, para), o.enviarFoto(dataUrl, texto, para) — Promise de { ok, erro }.
     * o.avisarDigitando(para), o.urlDaFoto(arquivo).
     * o.mudarEquipe(equipe) — Promise; ausente, a página não escolhe equipe (dirigente).
     * o.aoRecado(m, { minha, mencionado, destino }) — aviso dourado, selo de não lidas.
     * o.extras — elementos da página para o compositor (o botão de voz).
     */
    montar: function (o) {
      if (!document.getElementById("ce-estilo")) {
        var estilo = document.createElement("style");
        estilo.id = "ce-estilo";
        estilo.textContent = ESTILO;
        document.head.appendChild(estilo);
      }

      var recados = [];
      var pessoas = [];
      var meuId = "";
      var minhaEquipe = "";
      var silenciadoAte = 0;
      var digitandoAgora = {};
      var coresUsadas = {};
      /** id do recado → a linha dele na tela. */
      var linhas = {};
      var ultimoDigitando = 0;
      var relogioDoSilencio = 0;
      var relogioDoDigitando = 0;

      function corDaPessoa(chave) {
        if (Object.prototype.hasOwnProperty.call(coresUsadas, chave)) return CORES_DO_CHAT[coresUsadas[chave]];
        var ocupadas = {};
        Object.keys(coresUsadas).forEach(function (k) { ocupadas[coresUsadas[k]] = true; });
        var h = 0;
        for (var i = 0; i < chave.length; i += 1) h = (h * 31 + chave.charCodeAt(i)) >>> 0;
        var inicio = h % CORES_DO_CHAT.length;
        var escolhida = inicio;
        for (var k = 0; k < CORES_DO_CHAT.length; k += 1) {
          var idx = (inicio + k) % CORES_DO_CHAT.length;
          if (!ocupadas[idx]) { escolhida = idx; break; }
        }
        coresUsadas[chave] = escolhida;
        return CORES_DO_CHAT[escolhida];
      }

      function ehMinha(m) {
        if (m.daCabine) return false;
        if (m.deId && meuId) return m.deId === meuId;
        var nome = o.meuNome ? o.meuNome() : "";
        return !!nome && m.de === nome;
      }

      function fuiCitado(m) {
        return !!meuId && (m.mencoes || []).some(function (x) { return x.id === meuId; });
      }

      // ── peças novas em volta do que a página já tinha ──
      var topo = document.createElement("div");
      topo.className = "ce-topo";
      var presenca = document.createElement("div");
      presenca.className = "ce-presenca";
      presenca.setAttribute("aria-live", "polite");
      topo.appendChild(presenca);
      var seletorEquipe = null;
      if (o.mudarEquipe) {
        var rotuloEquipe = document.createElement("label");
        rotuloEquipe.className = "ce-equipe";
        rotuloEquipe.textContent = "Minha equipe";
        seletorEquipe = document.createElement("select");
        seletorEquipe.setAttribute("aria-label", "Minha equipe no chat");
        [["", "Nenhuma"]].concat(EQUIPES_DE_APARELHO.map(function (e) { return [e, EQUIPES[e]]; })).forEach(function (par) {
          var op = document.createElement("option");
          op.value = par[0];
          op.textContent = par[1];
          seletorEquipe.appendChild(op);
        });
        seletorEquipe.addEventListener("change", function () {
          var escolhida = seletorEquipe.value;
          Promise.resolve(o.mudarEquipe(escolhida)).then(function (r) {
            if (r && r.ok) {
              minhaEquipe = escolhida;
            } else {
              seletorEquipe.value = minhaEquipe;
              mostrarErro((r && r.erro) || "Não deu para mudar de equipe.");
            }
          });
        });
        rotuloEquipe.appendChild(seletorEquipe);
        topo.appendChild(rotuloEquipe);
      }
      o.lista.parentNode.insertBefore(topo, o.lista);
      o.lista.setAttribute("role", "log");

      var digitando = document.createElement("p");
      digitando.className = "ce-digitando";
      o.lista.parentNode.insertBefore(digitando, o.lista.nextSibling);

      var sugestoes = document.createElement("div");
      sugestoes.className = "ce-sugestoes";
      sugestoes.hidden = true;
      o.form.parentNode.insertBefore(sugestoes, o.form);

      var calado = document.createElement("p");
      calado.className = "ce-calado";
      calado.hidden = true;
      o.form.parentNode.insertBefore(calado, o.form);

      var linhaPara = document.createElement("label");
      linhaPara.className = "ce-para";
      linhaPara.textContent = "Para";
      var seletorPara = document.createElement("select");
      seletorPara.setAttribute("aria-label", "Para quem vai a mensagem");
      linhaPara.appendChild(seletorPara);
      o.form.parentNode.insertBefore(linhaPara, o.form);

      var foto = document.createElement("label");
      foto.className = (o.classeDoBotao ? o.classeDoBotao + " " : "") + "ce-foto";
      foto.setAttribute("aria-label", "Enviar foto");
      foto.title = "Enviar foto";
      foto.textContent = "📷";
      var arquivoDeFoto = document.createElement("input");
      arquivoDeFoto.type = "file";
      arquivoDeFoto.accept = "image/*";
      arquivoDeFoto.hidden = true;
      foto.appendChild(arquivoDeFoto);
      o.form.insertBefore(foto, o.enviar);
      (o.extras || []).forEach(function (el) { o.form.insertBefore(el, o.enviar); });

      var lupa = document.createElement("div");
      lupa.className = "ce-lupa";
      lupa.hidden = true;
      var lupaImg = document.createElement("img");
      lupaImg.alt = "Foto do chat";
      lupa.appendChild(lupaImg);
      lupa.addEventListener("click", function () { lupa.hidden = true; });
      document.body.appendChild(lupa);

      function mostrarErro(texto) {
        if (o.erro) o.erro.textContent = texto || "";
      }

      // ── destino ──
      function paraAtual() {
        var v = seletorPara.value || "todos";
        if (v === "todos") return { tipo: "todos" };
        if (v.indexOf("e:") === 0) return { tipo: "equipe", equipe: v.slice(2) };
        if (v.indexOf("p:") === 0) {
          var id = v.slice(2);
          var p = pessoas.filter(function (x) { return x.id === id; })[0];
          return { tipo: "pessoa", id: id, nome: p ? p.nome : "" };
        }
        return { tipo: "todos" };
      }

      function redesenharPara() {
        var antes = seletorPara.value || "todos";
        seletorPara.innerHTML = "";
        function opcao(pai, valor, rotulo) {
          var op = document.createElement("option");
          op.value = valor;
          op.textContent = rotulo;
          pai.appendChild(op);
        }
        opcao(seletorPara, "todos", "Todos");
        var grupoEquipes = document.createElement("optgroup");
        grupoEquipes.label = "Equipes";
        Object.keys(EQUIPES).forEach(function (e) { opcao(grupoEquipes, "e:" + e, EQUIPES[e]); });
        seletorPara.appendChild(grupoEquipes);
        var outros = pessoas.filter(function (p) { return p.id !== meuId && p.id !== "cabine"; });
        if (outros.length) {
          var grupoPessoas = document.createElement("optgroup");
          grupoPessoas.label = "Pessoas";
          outros.forEach(function (p) {
            opcao(grupoPessoas, "p:" + p.id, p.nome + (p.equipe ? " · " + EQUIPES[p.equipe] : ""));
          });
          seletorPara.appendChild(grupoPessoas);
        }
        // Quem escolheu uma pessoa que saiu volta a escrever para todos:
        // recado para quem não está mais aí é recado perdido.
        var existe = Array.prototype.some.call(seletorPara.options, function (op) { return op.value === antes; });
        seletorPara.value = existe ? antes : "todos";
      }

      function destinoEmPalavras(para) {
        if (!para || para.tipo === "todos") return "";
        if (para.tipo === "equipe") return "para " + (EQUIPES[para.equipe] || para.equipe);
        if (para.tipo === "pessoa") return "para " + (para.id === meuId ? "você" : para.nome || "uma pessoa");
        return "";
      }

      // ── presença ──
      function redesenharPresenca() {
        presenca.innerHTML = "";
        var rotulo = document.createElement("span");
        rotulo.textContent = "No chat:";
        presenca.appendChild(rotulo);
        pessoas.forEach(function (p) {
          var item = document.createElement("span");
          item.className = "ce-pessoa";
          var ponto = document.createElement("i");
          ponto.className = "ce-ponto";
          ponto.style.background = corDaPessoa(p.id === "cabine" ? "cabine" : "p:" + String(p.nome).trim().toLowerCase());
          item.appendChild(ponto);
          var nome = p.id === meuId ? "você" : p.nome;
          if (p.equipe && p.id !== "cabine") nome += " (" + EQUIPES[p.equipe] + ")";
          if (p.silenciado) nome += " — silenciado";
          item.appendChild(document.createTextNode(nome));
          presenca.appendChild(item);
        });
      }

      // ── digitando ──
      function redesenharDigitando() {
        var agora = Date.now();
        var nomes = Object.keys(digitandoAgora)
          .filter(function (id) { return digitandoAgora[id].ate > agora; })
          .map(function (id) { return digitandoAgora[id].nome; });
        digitando.textContent = nomes.length === 0
          ? ""
          : nomes.length === 1
            ? nomes[0] + " está digitando…"
            : nomes.join(" e ") + " estão digitando…";
        if (relogioDoDigitando) clearTimeout(relogioDoDigitando);
        if (nomes.length) relogioDoDigitando = setTimeout(redesenharDigitando, 1000);
      }

      // ── silêncio ──
      function redesenharCalado() {
        var calada = silenciadoAte > Date.now();
        calado.hidden = !calada;
        calado.textContent = calada
          ? "A cabine silenciou este aparelho no chat até " + hora(silenciadoAte) + ". Você continua lendo."
          : "";
        o.texto.disabled = calada;
        o.enviar.disabled = calada;
        arquivoDeFoto.disabled = calada;
        foto.style.opacity = calada ? "0.4" : "";
        (o.extras || []).forEach(function (el) { el.style.opacity = calada ? "0.4" : ""; el.style.pointerEvents = calada ? "none" : ""; });
        if (relogioDoSilencio) clearTimeout(relogioDoSilencio);
        if (calada) relogioDoSilencio = setTimeout(redesenharCalado, Math.min(60000, silenciadoAte - Date.now() + 50));
      }

      // ── a lista ──
      function textoComMencoes(el, m) {
        var texto = m.texto || "";
        var mencoes = m.mencoes || [];
        if (!mencoes.length) {
          el.textContent = texto;
          return;
        }
        // O nome mais comprido primeiro, como no servidor: em "@Ana Paula",
        // o destaque é da Ana Paula, não da Ana.
        var d = dobrarComOrigem(texto);
        var trechos = [];
        mencoes.slice().sort(function (a, b) { return b.nome.length - a.nome.length; }).forEach(function (p) {
          var chave = "@" + dobrarComOrigem(p.nome).alvo;
          var i = d.alvo.indexOf(chave);
          while (i >= 0) {
            var inicio = d.origem[i];
            var fim = d.origem[i + chave.length];
            var ocupado = trechos.some(function (t) { return inicio < t.fim && fim > t.inicio; });
            if (!ocupado) {
              trechos.push({ inicio: inicio, fim: fim, pessoa: p });
              break;
            }
            i = d.alvo.indexOf(chave, i + 1);
          }
        });
        trechos.sort(function (a, b) { return a.inicio - b.inicio; });
        var pos = 0;
        trechos.forEach(function (t) {
          el.appendChild(document.createTextNode(texto.slice(pos, t.inicio)));
          var b = document.createElement("b");
          b.className = "ce-mencao" + (t.pessoa.id === meuId ? " eu" : "");
          b.style.color = corDaPessoa("p:" + String(t.pessoa.nome).trim().toLowerCase());
          b.textContent = texto.slice(t.inicio, t.fim);
          el.appendChild(b);
          pos = t.fim;
        });
        el.appendChild(document.createTextNode(texto.slice(pos)));
      }

      function junto(a, b) {
        return !!a && !!b && autorDoGrupo(a) === autorDoGrupo(b) && Math.abs(b.em - a.em) < JANELA_DO_GRUPO_MS;
      }

      /** Um recado na tela, sabendo se abre e/ou fecha o grupo dele. */
      function linhaDe(m, primeiro, ultimo) {
        var minha = ehMinha(m);
        var cor = corDaPessoa(chaveDaPessoa(m));

        var linha = document.createElement("div");
        linha.className = "ce-linha-msg" + (minha ? " minha" : "") + (primeiro ? "" : " junta");
        linha.setAttribute("data-recado", m.id);

        if (!minha) {
          var avatar = document.createElement("span");
          avatar.className = "ce-avatar" + (ultimo ? "" : " vazio");
          avatar.style.background = cor;
          avatar.textContent = iniciais(m.daCabine ? "Cabine" : m.de);
          avatar.setAttribute("aria-hidden", "true");
          linha.appendChild(avatar);
        }

        var balao = document.createElement("div");
        balao.className = "ce-balao";
        if (!minha && primeiro) {
          var nome = document.createElement("p");
          nome.className = "ce-nome";
          nome.style.color = cor;
          nome.textContent = m.daCabine ? "Cabine" : m.de;
          balao.appendChild(nome);
        }
        var destino = destinoEmPalavras(m.para);
        if (destino) {
          var chip = document.createElement("p");
          chip.className = "ce-para-chip";
          chip.textContent = "→ " + destino.replace(/^para /, "");
          balao.appendChild(chip);
        }
        if (m.apagada) {
          var apagada = document.createElement("p");
          apagada.className = "ce-apagada";
          apagada.textContent = "Recado apagado pela cabine";
          balao.appendChild(apagada);
        } else {
          if (m.foto && m.foto.arquivo) {
            var img = document.createElement("img");
            img.className = "ce-foto-msg";
            img.alt = "Foto de " + (minha ? "você" : m.de);
            img.src = o.urlDaFoto(m.foto.arquivo);
            img.addEventListener("click", function () {
              lupaImg.src = img.src;
              lupa.hidden = false;
            });
            balao.appendChild(img);
          }
          if (m.audio) {
            var som = document.createElement("audio");
            som.controls = true;
            som.preload = "none";
            som.src = m.audio;
            som.style.width = "100%";
            balao.appendChild(som);
          }
          if (m.texto) {
            var texto = document.createElement("p");
            texto.className = "ce-texto-msg";
            textoComMencoes(texto, m);
            balao.appendChild(texto);
          }
        }
        if (ultimo) {
          var quando = document.createElement("span");
          quando.className = "ce-hora";
          quando.textContent = hora(m.em);
          balao.appendChild(quando);
        }
        linha.appendChild(balao);
        linhas[m.id] = linha;
        return linha;
      }

      function posicao(i) {
        return { primeiro: !junto(recados[i - 1], recados[i]), ultimo: !junto(recados[i], recados[i + 1]) };
      }

      function estaNoFim() {
        return o.lista.scrollHeight - o.lista.scrollTop - o.lista.clientHeight < 80;
      }

      /** A lista inteira, ao conectar. */
      function desenharTudo() {
        o.lista.innerHTML = "";
        linhas = {};
        recados.forEach(function (m, i) {
          var p = posicao(i);
          o.lista.appendChild(linhaDe(m, p.primeiro, p.ultimo));
        });
      }

      /**
       * Recado novo entra no fim, sem redesenhar os outros: redesenhar tudo
       * recriava o player do recado de voz e cortava quem estava ouvindo.
       * Se o novo entra no grupo do anterior, o anterior só entrega a hora
       * e as iniciais para ele.
       */
      function acrescentar(m) {
        var noFim = estaNoFim();
        var antes = recados[recados.length - 2];
        var mesmoGrupo = junto(antes, m);
        var linhaAntes = mesmoGrupo ? linhas[antes.id] : null;
        if (linhaAntes) {
          var quando = linhaAntes.querySelector(".ce-hora");
          if (quando) quando.parentNode.removeChild(quando);
          var avatar = linhaAntes.querySelector(".ce-avatar");
          if (avatar) avatar.className = "ce-avatar vazio";
        }
        o.lista.appendChild(linhaDe(m, !mesmoGrupo, true));
        if (noFim) rolar();
      }

      /** Só a linha de um recado é refeita (o apagado, o novo primeiro da lista). */
      function redesenharRecado(id) {
        for (var i = 0; i < recados.length; i += 1) {
          if (recados[i].id !== id) continue;
          var velha = linhas[id];
          var p = posicao(i);
          var nova = linhaDe(recados[i], p.primeiro, p.ultimo);
          if (velha && velha.parentNode) velha.parentNode.replaceChild(nova, velha);
          return;
        }
      }

      function rolar() {
        o.lista.scrollTop = o.lista.scrollHeight;
      }

      // ── @menções: sugestões enquanto digita ──
      function redesenharSugestoes() {
        var antes = o.texto.value.slice(0, o.texto.selectionStart || o.texto.value.length);
        var achou = /@([^@\n]{0,24})$/.exec(antes);
        sugestoes.innerHTML = "";
        if (!achou) { sugestoes.hidden = true; return; }
        var frag = dobrar(achou[1]);
        var candidatos = pessoas.filter(function (p) {
          return p.id !== meuId && dobrar(p.nome).indexOf(frag) === 0;
        }).slice(0, 5);
        if (!candidatos.length) { sugestoes.hidden = true; return; }
        candidatos.forEach(function (p) {
          var b = document.createElement("button");
          b.type = "button";
          b.textContent = "@" + p.nome;
          b.addEventListener("click", function () {
            var fim = o.texto.selectionStart || o.texto.value.length;
            var comeco = fim - achou[0].length;
            var novo = o.texto.value.slice(0, comeco) + "@" + p.nome + " " + o.texto.value.slice(fim);
            o.texto.value = novo;
            var cursor = comeco + p.nome.length + 2;
            o.texto.focus();
            o.texto.setSelectionRange(cursor, cursor);
            sugestoes.hidden = true;
          });
          sugestoes.appendChild(b);
        });
        sugestoes.hidden = false;
      }

      // ── envio ──
      function enviarTexto() {
        var texto = o.texto.value.trim();
        if (!texto || o.enviar.disabled) return;
        o.enviar.disabled = true;
        mostrarErro("");
        Promise.resolve(o.enviarTexto(texto, paraAtual()))
          .then(function (r) {
            if (r && r.ok) {
              o.texto.value = "";
              sugestoes.hidden = true;
            } else if (r && r.erro) {
              mostrarErro(r.erro);
            }
          })
          .catch(function () { mostrarErro("Sem conexão com a cabine."); })
          .then(function () { o.enviar.disabled = silenciadoAte > Date.now(); });
      }

      /** A foto sai do celular já reduzida, como JPEG. */
      function reduzir(arquivo) {
        return new Promise(function (ok, falha) {
          var url = URL.createObjectURL(arquivo);
          var imagem = new Image();
          imagem.onload = function () {
            var escala = Math.min(1, LADO_DA_FOTO / Math.max(imagem.naturalWidth, imagem.naturalHeight));
            var canvas = document.createElement("canvas");
            canvas.width = Math.max(1, Math.round(imagem.naturalWidth * escala));
            canvas.height = Math.max(1, Math.round(imagem.naturalHeight * escala));
            canvas.getContext("2d").drawImage(imagem, 0, 0, canvas.width, canvas.height);
            URL.revokeObjectURL(url);
            ok(canvas.toDataURL("image/jpeg", 0.85));
          };
          imagem.onerror = function () {
            URL.revokeObjectURL(url);
            falha(new Error("Não consegui abrir essa foto."));
          };
          imagem.src = url;
        });
      }

      arquivoDeFoto.addEventListener("change", function () {
        var arquivo = arquivoDeFoto.files && arquivoDeFoto.files[0];
        arquivoDeFoto.value = "";
        if (!arquivo) return;
        mostrarErro("Mandando a foto…");
        reduzir(arquivo)
          .then(function (dataUrl) { return o.enviarFoto(dataUrl, o.texto.value.trim(), paraAtual()); })
          .then(function (r) {
            if (r && r.ok) {
              mostrarErro("");
              o.texto.value = "";
            } else {
              mostrarErro((r && r.erro) || "A foto não foi.");
            }
          })
          .catch(function (e) { mostrarErro((e && e.message) || "A foto não foi."); });
      });

      o.form.addEventListener("submit", function (ev) {
        ev.preventDefault();
        enviarTexto();
      });
      o.texto.addEventListener("keydown", function (ev) {
        if (ev.key === "Enter" && !ev.shiftKey) {
          ev.preventDefault();
          enviarTexto();
        }
      });
      o.texto.addEventListener("input", function () {
        redesenharSugestoes();
        var agora = Date.now();
        if (o.texto.value.trim() && agora - ultimoDigitando > 1500) {
          ultimoDigitando = agora;
          // "Digitando…" é cortesia: sem rede, o recado de verdade é que avisa.
          Promise.resolve(o.avisarDigitando(paraAtual())).catch(function () {});
        }
      });

      redesenharPara();
      redesenharPresenca();

      return {
        /** O retrato inteiro, quando a página conecta ou reconecta. */
        inicio: function (d) {
          meuId = (d.eu && d.eu.id) || meuId;
          minhaEquipe = (d.eu && d.eu.equipe) || "";
          if (seletorEquipe) seletorEquipe.value = minhaEquipe;
          silenciadoAte = d.silenciadoAte || 0;
          pessoas = d.presenca || [];
          recados = (d.chat || []).slice();
          coresUsadas = {};
          redesenharPresenca();
          redesenharPara();
          redesenharCalado();
          desenharTudo();
          rolar();
        },
        /** Um evento do fluxo. Devolve true se era do chat. */
        evento: function (d) {
          if (d.tipo === "chat" && d.mensagem) {
            var m = d.mensagem;
            if (recados.some(function (x) { return x.id === m.id; })) return true;
            recados.push(m);
            acrescentar(m);
            if (recados.length > 200) {
              recados.splice(0, recados.length - 200).forEach(function (x) {
                var el = linhas[x.id];
                if (el && el.parentNode) el.parentNode.removeChild(el);
                delete linhas[x.id];
              });
              // O novo primeiro da lista passa a abrir o grupo: mostra o nome.
              redesenharRecado(recados[0].id);
            }
            delete digitandoAgora[m.deId || ""];
            redesenharDigitando();
            var minha = ehMinha(m);
            if (minha) rolar();
            if (o.aoRecado) o.aoRecado(m, { minha: minha, mencionado: fuiCitado(m), destino: destinoEmPalavras(m.para) });
            return true;
          }
          if (d.tipo === "presenca") {
            pessoas = d.pessoas || [];
            redesenharPresenca();
            redesenharPara();
            return true;
          }
          if (d.tipo === "digitando") {
            if (d.deId && d.deId !== meuId) {
              digitandoAgora[d.deId] = { nome: d.de, ate: Date.now() + DIGITANDO_MS };
              redesenharDigitando();
            }
            return true;
          }
          if (d.tipo === "chat-apagada") {
            recados.forEach(function (x) {
              if (x.id !== d.id) return;
              x.apagada = true;
              x.texto = "";
              delete x.audio;
              delete x.foto;
              x.mencoes = [];
            });
            redesenharRecado(d.id);
            return true;
          }
          if (d.tipo === "silenciado") {
            silenciadoAte = d.ate || 0;
            redesenharCalado();
            return true;
          }
          return false;
        },
        para: paraAtual,
        rolar: rolar,
      };
    },
  };
})();
