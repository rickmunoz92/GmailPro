/* Synthetic row contract shared by appearance and list tests. */
window.GmailProTestRow = function row({ unread = false, label = "", attachment = false, sender = null, participants = null, count = 3,
    threadId = "synthetic-thread", legacyThreadId = "legacy-thread", lastMessageId = "legacy-2",
    subject = "Project update", importance = true, dateTitle = "Mon, Sep 14, 2026, 1:31\u202fPM", dateText = "Sep 14" } = {}) {
    const table = document.createElement("table");
    table.innerHTML = `<tbody><tr class="zA ${unread ? "zE" : "yO"}" role="row" tabindex="0" draggable="true">
      <td class="PF xY"></td>
      <td class="oZ-x3 xY"><div class="oZ-jc T-Jo" role="checkbox" tabindex="-1" aria-checked="false" aria-label="Select message">□</div></td>
      <td class="apU xY"><span role="button" aria-label="Not starred">☆</span></td>
      <td class="WA xY"><div role="switch" aria-checked="false" aria-label="Important">›</div></td>
      <td class="yX xY" role="gridcell" tabindex="-1"><div class="afn"></div><div class="yW"><span class="bA4"></span></div></td>
      <td class="a4W xY" role="gridcell" tabindex="-1"><div class="xS" role="link"><div class="xT"><div class="y6"><span class="bog"><span class="bqe" data-thread-id="synthetic-thread"></span></span></div><span class="y2"> – Synthetic preview retained in the DOM</span></div></div></td>
      <td class="byZ xY" role="gridcell"></td><td class="yf xY"></td>
      <td class="xW xY" role="gridcell" tabindex="-1"><span title="" aria-label=""><span></span></span></td>
      <td class="bq4 xY"><ul class="bqY" role="toolbar"><li role="button" aria-label="Archive">A</li><li role="button" aria-label="Delete">D</li><li role="button" aria-label="Mark unread">U</li><li role="button" aria-label="Snooze">S</li></ul></td>
      <td class="xY"></td></tr></tbody>`;
    table.setAttribute("role", "grid");
    const node = table.querySelector("tr");
    const group = node.querySelector('.yW > .bA4');
    const members = participants || (sender === null ? [{name:'Alex',email:'alex@example.com'}, {name:'Morgan',email:'morgan@example.com'}] : [{name:sender,email:'alex@example.com'}]);
    members.forEach(({name, email}, index) => {
      if (index) {
        const separator = document.createElement('span'); separator.className = 'yP'; separator.textContent = ', '; group.append(separator);
      }
      const participant = document.createElement('span'); participant.className = 'sender yP';
      participant.setAttribute('email', email); participant.setAttribute('name', name);
      participant.setAttribute('data-hovercard-id', email); participant.setAttribute('translate', 'no');
      participant.textContent = name; group.append(participant);
    });
    if (count !== null) {
      const total = document.createElement('span'); total.className = 'bx0'; total.textContent = String(count);
      group.after(document.createTextNode(' '), total);
    }
    const identity = node.querySelector('[data-thread-id]');
    identity.setAttribute('data-thread-id', threadId); identity.setAttribute('data-legacy-thread-id', legacyThreadId);
    identity.setAttribute('data-legacy-last-message-id', lastMessageId);
    identity.setAttribute('data-legacy-last-non-draft-message-id', lastMessageId);
    node.querySelector(".bqe").textContent = subject;
    const date = node.querySelector(".xW > span");
    date.title = dateTitle;
    date.setAttribute("aria-label", dateTitle);
    date.firstElementChild.textContent = dateText;
    if (label) {
      const labels = document.createElement("div"); labels.className = "yi";
      const badge = document.createElement("div"); badge.className = "at"; badge.title = label;
      const wrapper = document.createElement("div"); wrapper.className = "au";
      const text = document.createElement("div"); text.className = "av"; text.textContent = label;
      wrapper.append(text); badge.append(wrapper);
      const group = document.createElement("div"); group.className = "ar as";
      group.append(badge); labels.append(group); node.querySelector(".xT").prepend(labels);
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
