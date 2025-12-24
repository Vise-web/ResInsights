async function reviewResume() {
  const resumeText = document.getElementById("resume").value;

  if (!resumeText) {
    alert("Please paste your resume!");
    return;
  }

  try {
    const response = await fetch("/review", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ resumeText })
    });

    const data = await response.json();

    // show result directly (NO redirect yet)
    localStorage.setItem("reviewResult", data.review);

    // force server-based navigation
    window.location.assign("/result.html");

  } catch (err) {
    alert("Error connecting to server");
  }
}
