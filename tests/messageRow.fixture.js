/* Synthetic row contract shared by appearance and list tests. */
window.GmailProTestRow = function row({ unread = false, label = "", attachment = false, sender = "Alex, Morgan 3", subject = "Project update", importance = true } = {}) {
    const table = document.createElement("table");
    table.innerHTML = `<tbody><tr class="zA ${unread ? "zE" : "yO"}" role="row" tabindex="0" draggable="true">
      <td class="PF xY"></td>
      <td class="oZ-x3 xY"><div role="checkbox" tabindex="-1" aria-checked="false" aria-label="Select message">□</div></td>
      <td class="apU xY"><span role="button" aria-label="Not starred">☆</span></td>
      <td class="WA xY"><div role="switch" aria-checked="false" aria-label="Important">›</div></td>
      <td class="yX xY" role="gridcell" tabindex="-1"><div class="afn"></div><div class="yW"><span class="bA4"><span class="sender" email="alex@example.com"></span></span></div></td>
      <td class="a4W xY" role="gridcell" tabindex="-1"><div class="xS" role="link"><div class="xT"><div class="y6"><span class="bog"><span class="bqe" data-thread-id="synthetic-thread"></span></span></div><span class="y2"> – Synthetic preview retained in the DOM</span></div></div></td>
      <td class="byZ xY" role="gridcell"></td><td class="yf xY"></td>
      <td class="xW xY" role="gridcell" tabindex="-1"><span title="Synthetic date" aria-label="Synthetic date">5:25 PM</span></td>
      <td class="bq4 xY"><ul class="bqY" role="toolbar"><li role="button" aria-label="Archive">A</li><li role="button" aria-label="Delete">D</li><li role="button" aria-label="Mark unread">U</li><li role="button" aria-label="Snooze">S</li></ul></td>
      <td class="xY"></td></tr></tbody>`;
    table.setAttribute("role", "grid");
    const node = table.querySelector("tr");
    node.querySelector(".sender").textContent = sender;
    node.querySelector(".bqe").textContent = subject;
    if (label) {
      const labels = document.createElement("div"); labels.className = "yi";
      const badge = document.createElement("div"); badge.className = "at"; badge.title = label;
      const text = document.createElement("div"); text.className = "av"; text.textContent = label; badge.append(text);
      labels.append(badge); node.querySelector(".xT").prepend(labels);
    }
    if (attachment) {
      const icon = document.createElement("span"); icon.setAttribute("role", "img"); icon.setAttribute("aria-label", "Has attachment"); icon.textContent = "⊙";
      node.querySelector(".yf").append(icon);
    }
    if (!importance) node.querySelector(".WA").style.display = "none";
    document.getElementById("workspace").append(table);
    return node;
  }
;
