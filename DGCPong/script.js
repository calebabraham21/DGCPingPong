import {
  getFirestore,
  collection,
  addDoc,
  doc,
  getDocs,
  getDoc,
  setDoc,
  updateDoc
} from "https://www.gstatic.com/firebasejs/10.11.1/firebase-firestore.js";

const db = getFirestore();

document.addEventListener("DOMContentLoaded", async () => {
  const tableBody = document.querySelector(".standings-table tbody");
  const table = document.querySelector("table");
  const headers = table.querySelectorAll("th");

  const playersSnapshot = await getDocs(collection(db, "players"));
  playersSnapshot.forEach(docSnap => {
    const data = docSnap.data();
    const row = document.createElement("tr");
    row.dataset.playerId = docSnap.id;
    row.innerHTML = `
      <td class="player-name">${data.name}</td>
      <td class="wins">${data.wins || 0}</td>
      <td class="losses">${data.losses || 0}</td>
      <td class="win-pct">${(data.winPct || 0).toFixed(2)}%</td>
      <td class="points-scored">${data.pointsScored || 0}</td>
      <td class="points-against">${data.pointsAgainst || 0}</td>
      <td class="point-diff">${data.pointDiff || 0}</td>
      <td class="sos">${(data.sos || 0).toFixed(2)}</td>
    `;
    tableBody.appendChild(row);
  });

  updateSoS();

headers.forEach((header, index) => {
  header.addEventListener("click", () => {
    const rows = Array.from(tableBody.querySelectorAll("tr"));
    const isAscending = header.classList.contains("asc");
    const direction = isAscending ? -1 : 1;

    rows.sort((rowA, rowB) => {
      const cellA = rowA.children[index].textContent.trim();
      const cellB = rowB.children[index].textContent.trim();
      const valueA = isNaN(cellA) ? cellA : parseFloat(cellA);
      const valueB = isNaN(cellB) ? cellB : parseFloat(cellB);
      return valueA > valueB ? direction : valueA < valueB ? -direction : 0;
    });

    tableBody.innerHTML = "";
    rows.forEach(row => tableBody.appendChild(row));

    // Clear all sort icons
    document.querySelectorAll(".sort-icon").forEach(icon => (icon.innerHTML = ""));
    headers.forEach(h => h.classList.remove("asc", "desc"));

    // Apply new class + icon
    header.classList.add(isAscending ? "desc" : "asc");
    const icon = header.querySelector(".sort-icon");
    icon.innerHTML = isAscending ? "&#9660;" : "&#9650;"; // ▼ or ▲
  });
});

});

// Modal handling
const modal = document.getElementById("matchModal");
const openBtn = document.getElementById("openModalBtn");
const closeBtn = document.getElementById("closeModalBtn");
const matchForm = document.getElementById("matchForm");
const tableBody = document.querySelector(".standings-table tbody");

openBtn.onclick = () => modal.style.display = "flex";
closeBtn.onclick = () => modal.style.display = "none";
window.onkeydown = e => { if (e.key === "Escape") modal.style.display = "none"; };

// Submit match
matchForm.addEventListener("submit", async e => {
  e.preventDefault();

  const player1 = matchForm.player1.value.trim();
  const player2 = matchForm.player2.value.trim();
  const score1 = parseInt(matchForm.score1.value);
  const score2 = parseInt(matchForm.score2.value);
  const date = matchForm.matchDate.value;

  if (!player1 || !player2 || player1 === player2) {
    alert("Invalid players");
    return;
  }

  await addDoc(collection(db, "matches"), {
    player1, player2, score1, score2, matchDate: date, timestamp: Date.now()
  });

  await Promise.all([
    updatePlayerInFirestore(player1, score1, score2),
    updatePlayerInFirestore(player2, score2, score1)
  ]);

  matchForm.reset();
  modal.style.display = "none";
  location.reload();
});

async function updatePlayerInFirestore(name, pointsScored, pointsAgainst) {
  const playersRef = collection(db, "players");
  const snapshot = await getDocs(playersRef);

  let docRef = null;
  snapshot.forEach(docSnap => {
    if (docSnap.data().name === name) docRef = docSnap.ref;
  });

  if (!docRef) {
    docRef = doc(collection(db, "players"));
    await setDoc(docRef, { name, wins: 0, losses: 0, pointsScored: 0, pointsAgainst: 0 });
  }

  const docSnap = await getDoc(docRef);
  const data = docSnap.data();
  const win = pointsScored > pointsAgainst;

  const newWins = data.wins + (win ? 1 : 0);
  const newLosses = data.losses + (win ? 0 : 1);
  const newScored = data.pointsScored + pointsScored;
  const newAgainst = data.pointsAgainst + pointsAgainst;
  const diff = newScored - newAgainst;
  const pct = (newWins + newLosses) > 0 ? (newWins / (newWins + newLosses)) * 100 : 0;

  await updateDoc(docRef, {
    wins: newWins,
    losses: newLosses,
    pointsScored: newScored,
    pointsAgainst: newAgainst,
    pointDiff: diff,
    winPct: pct
  });
}

function updateSoS() {
  const rows = Array.from(document.querySelectorAll(".standings-table tbody tr"));
  const records = rows.map(row => {
    return {
      name: row.querySelector(".player-name").textContent,
      winPct: parseFloat(row.querySelector(".win-pct").textContent) || 0
    };
  });

  rows.forEach(row => {
    const name = row.querySelector(".player-name").textContent;
    const avg = records.filter(r => r.name !== name).reduce((a, b) => a + b.winPct, 0) / (records.length - 1);
    row.querySelector(".sos").textContent = avg.toFixed(2);
  });
}
