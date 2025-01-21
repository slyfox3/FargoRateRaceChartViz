function p_at(z, i, j) {
  if (i < 0 || j < 0) {
    return 0.0;
  } else {
    return z[i][j];
  }
}

function player1_advance(accu_prob, p, i, j) {
  return p_at(accu_prob, i, j) * p;
}

function player2_advance(accu_prob, p, i, j) {
  return p_at(accu_prob, i, j) * (1 - p);
}

function accu_prob(p, rows, cols) {
  let z = [];
  for (let i = 0; i < rows; i++) {
    z.push([]);
    for (let j = 0; j < cols; j++) {
      if (i == 0 && j == 0) {
        z[i].push(1.0); // race starts here 100%
      } else {
        z[i].push(
          player1_advance(z, p, i, j - 1) + player2_advance(z, p, i - 1, j)
        );
      }
    }
  }
  return z;
}

function sum_player1_wins(accu_prob, p, i, j) {
  sum = 0.0;
  for (let k = 0; k < i; k++) {
    sum += player1_advance(accu_prob, p, k, j - 1);
  }
  return sum;
}

function sum_player2_wins(accu_prob, p, i, j) {
  sum = 0.0;
  for (let k = 0; k < j; k++) {
    sum += player2_advance(accu_prob, p, i - 1, k);
  }
  return sum;
}

function race_prob(p, accu_prob) {
  const rows = accu_prob.length;
  const cols = accu_prob[0].length;
  let z = [];
  for (let i = 0; i < rows; i++) {
    z.push([]);
    for (let j = 0; j < cols; j++) {
      prob = null;
      if (i > 0 && j > 0) {
        col_sum = sum_player1_wins(accu_prob, p, i, j);
        row_sum = sum_player2_wins(accu_prob, p, i, j);
        prob = col_sum / (col_sum + row_sum);
      }
      z[i].push(prob);

      // speed up when prob is too close to 0% or 100%
      if (rows > 80 && (prob > 1 - 1e-5 || prob < 1e-5)) {
        for (let k = 0; k < 3 && j + 1 < cols; k++) {
          z[i].push(prob);
          j++;
        }
      }
    }
  }
  return z;
}

function flip_prob(arr) {
  return arr.map((row) => row.map((p) => (p ? 1 - p : null)));
}

function gen_race_annotation(r1, r2, n) {
  return {
    x: r1,
    y: r2,
    text: `R${n}`,
    showarrow: false,
  };
}

function gen_handicapped_races(race_base, sign) {
  n = parseInt(race_base);
  let rs = [];
  for (i = 0; ; ++i) {
    r1 = n + sign * i;
    r2 = n - sign * i;
    if (r1 * 3 < r2 || r2 * 3 < r1) {
      break; // avoid lopsided race
    }
    rs.push(gen_race_annotation(r1, r2, n));
    if (sign < 0) {
      r1--;
    } else {
      r2--;
    }

    if (r1 * 3 < r2 || r2 * 3 < r1) {
      break; // avoid lopsided race
    }
    rs.push(gen_race_annotation(r1, r2, n));
  }
  return rs;
}

function getDiv() {
  return document.getElementById("myDiv");
}

function resizePlot() {
  const div = getDiv();
  const screenHeight = window.innerHeight;
  div.style.height = `${screenHeight}px`;
  const w = div.offsetWidth;
  const h = div.offsetHeight;
  const l = Math.min(w * 0.9, h * 0.85);
  const layoutUpdate = {
    width: l,
    height: l,
    margin: {
      l: 50,
      r: 0,
      b: 0,
      t: 0,
      pad: 0,
    },
  };

  Plotly.relayout("myDiv", layoutUpdate);
}

function reload_heatmap_data(data) {
  Plotly.restyle(getDiv(), {
    z: [data[0].z],
    customdata: [data[0].customdata],
  });
}
function reload_races_annotations(layout) {
  Plotly.relayout(getDiv(), layout);
}

function on_rating_change() {
  const player1_fargo = document.getElementById("fargo_slider1").value;
  const player2_fargo = document.getElementById("fargo_slider2").value;
  document.getElementById("fargo_value1").textContent = player1_fargo;
  document.getElementById("fargo_value2").textContent = player2_fargo;
  document.getElementById("delta_value").textContent =
    player1_fargo - player2_fargo;

  const player1_percentage =
    single_game_player1_winning_prob(player1_fargo, player2_fargo) * 100;
  document.getElementById("prob_value").textContent =
    player1_percentage.toFixed(1);

  const race_base = document.getElementById("race_slider").value;
  document.getElementById("race_value").textContent = race_base;

  const [data, layout] = gen_heatmap(player1_fargo, player2_fargo, race_base);
  reload_heatmap_data(data);
  reload_races_annotations(layout);
}

document.getElementById("fargo_slider1").oninput = function () {
  on_rating_change();
};
document.getElementById("fargo_slider2").oninput = function () {
  on_rating_change();
};
document.getElementById("race_slider").oninput = function () {
  on_rating_change();
};

function single_game_player1_winning_prob(player1_fargo, player2_fargo) {
  const fargo_delta = player1_fargo - player2_fargo;
  const player1_share = Math.pow(2.0, fargo_delta / 100.0);
  return player1_share / (player1_share + 1);
}

function gen_heatmap(player1_fargo, player2_fargo, race_base) {
  const p = single_game_player1_winning_prob(player1_fargo, player2_fargo);
  const handicapped_sign = p > 0.5 ? 1 : -1;
  const cols = Math.ceil(race_base * 1.5) + 1;
  const rows = cols;
  const accu_tab = accu_prob(p, rows, cols);
  const player1_wins_prob = race_prob(p, accu_tab);
  const player2_wins_prob = flip_prob(player1_wins_prob);

  const data = [
    {
      z: player1_wins_prob,
      customdata: player2_wins_prob,
      hovertemplate:
        "Player1 races to  %{x:>2} \t (%{z:>.2%})<br>" +
        "Player2 races to  %{y:>2} \t (%{customdata:>.2%})<extra></extra>",
      colorscale: "Picnic",
      type: "heatmap",
      showscale: false,
    },
  ];

  const layout = {
    yaxis: {
      autorange: "reversed",
      scaleanchor: "x",
    },
    xaxis: {
      autorange: true,
    },
    annotations: gen_handicapped_races(race_base, handicapped_sign),
  };

  return [data, layout];
}

function init_heatmap() {
  return [
    {
      z: [[0]],
      customdata: [[0]],
      hovertemplate:
        "Player1 races to  %{x:>2} \t (%{z:>.2%})<br>" +
        "Player2 races to  %{y:>2} \t (%{customdata:>.2%})<extra></extra>",
      colorscale: "Picnic",
      type: "heatmap",
      showscale: false,
    },
  ];
}

const config = {
  responsive: true,
};

const layout = {};
Plotly.newPlot(getDiv(), init_heatmap(), layout, config);
window.addEventListener("resize", resizePlot);
resizePlot(); // Initial resize
on_rating_change(); // Initial rendering
