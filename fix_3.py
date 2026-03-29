// src/index.js

// Add a new function to generate a marketing explainer video
function generateMarketingVideo() {
  const videoContent = `
    <video width="640" height="360" controls>
      <source src="https://example.com/shipli-marketing-video.mp4" type="video/mp4">
      Your browser does not support the video tag.
    </video>
  `;
  document.getElementById('marketing-video-container').innerHTML = videoContent;
}

// Call the function to generate the video when the page loads
window.onload = function() {
  generateMarketingVideo();
};