$(document).ready(function(){

// ==================== TOAST NOTIFICATIONS ====================

function showToast(message, type = "info") {
  const toast = document.createElement('div');
  toast.className = 'bg-slate-800 border border-slate-700 rounded-lg shadow-2xl p-4 flex items-center gap-3 max-w-sm transform transition-all duration-300 opacity-0 translate-x-4';

  const config = {
    success: { icon: '✓', color: 'text-emerald-400', bgColor: 'bg-emerald-500/20' },
    error: { icon: '✕', color: 'text-red-400', bgColor: 'bg-red-500/20' },
    warning: { icon: '⚠', color: 'text-amber-400', bgColor: 'bg-amber-500/20' },
    info: { icon: 'ℹ', color: 'text-blue-400', bgColor: 'bg-blue-500/20' }
  };

  const { icon, color, bgColor } = config[type] || config.info;

  toast.innerHTML = `
    <div class="flex-shrink-0">
      <div class="w-8 h-8 rounded-full ${bgColor} flex items-center justify-center">
        <span class="${color} text-lg font-bold">${icon}</span>
      </div>
    </div>
    <p class="text-sm text-slate-100 flex-1">${message}</p>
  `;

  const container = document.getElementById('toast-container');
  if (!container) {
    const newContainer = document.createElement('div');
    newContainer.id = 'toast-container';
    newContainer.className = 'fixed top-4 right-4 z-50 space-y-2';
    document.body.appendChild(newContainer);
  }

  document.getElementById('toast-container').appendChild(toast);

  // Trigger slide-in animation
  setTimeout(() => {
    toast.classList.remove('opacity-0', 'translate-x-4');
  }, 10);

  // Remove after 3 seconds
  setTimeout(() => {
    toast.classList.add('opacity-0', 'translate-x-4');
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// ==================== GLOBAL VARIABLES ====================

let currentAudio = null;
let currentSort = { column: 'date', ascending: false };  // Default: newest first

// ==================== INITIALIZATION ====================

// Get the list of songs in the SD card
$.getJSON("/songs", function(data) {
	$('#songs-select').empty();
	$('#songs-select').append(new Option("Select a song...", ""));
	$.each(data, function(key, fileObj) {
		$('#songs-select').append(new Option(fileObj.name, fileObj.name));
	});
});

// Load file list
refreshFileList();

// ==================== BUTTON EVENT HANDLERS ====================

$("#get-tag-id-button").on("click", function() {
	$.get("/tagid", function(data) {
		if (data.tagid) {
			$("#tag-id").val(data.tagid);
			showToast("Tag detected: " + data.tagid, "success");
		} else {
			$("#tag-id").val("");
			showToast("No tag detected. Please place a tag on the reader.", "warning");
		}
	});
});

$("#add-mapping-button").on("click", function() {
	const newtagid = $("#tag-id").val();
	const newsong = $("#songs-select").find(":selected").text();

	if(newtagid == "") {
		showToast("No Tag ID found. Press 'Scan Tag' with a tag on the reader.", "error");
		return;
	}

	if(newsong == "" || newsong == "Select a song...") {
		showToast("Please select a song from the dropdown.", "error");
		return;
	}

	console.log("Adding " + newtagid + " - " + newsong);

	$.ajax({
		type: 'POST',
		url: '/addmapping',
		data: JSON.stringify ({tagid: newtagid, song: newsong}),
		contentType: "application/json",
		dataType: 'json',
		complete: function(jqXHR, textStatus) {
			if(jqXHR.status == 200) {
				showToast("Mapping added successfully!", "success");
				$("#tag-id").val("");
				refreshFileList(); // Refresh file list to show new mapping
			}
			else {
				showToast("Unable to add mapping: " + jqXHR.responseJSON["result"], "error");
			}
		}
	});
});

// ==================== FILE MANAGEMENT ====================

function refreshFileList() {
	console.log("Refreshing file list...");

	Promise.all([
		$.getJSON("/songs"),
		$.getJSON("/mappings")
	]).then(([songs, mappings]) => {
		console.log("Loaded songs:", songs);
		console.log("Loaded mappings:", mappings);

		// Handle null/undefined mappings
		if (!mappings) {
			console.log("No mappings returned, using empty array");
			mappings = [];
		}

		$("#files-tbody").empty();

		if (!songs || songs.length === 0) {
			console.log("No songs found, showing empty state");
			$('#no-files').removeClass('hidden');
			return;
		} else {
			$('#no-files').addClass('hidden');
		}

		songs.forEach((fileObj, index) => {
			// Format file size
			const sizeInMB = (fileObj.size / (1024 * 1024)).toFixed(2);
			const sizeDisplay = fileObj.size < 1024*1024 ?
				`${(fileObj.size/1024).toFixed(1)} KB` :
				`${sizeInMB} MB`;

			// Format upload date
			let dateDisplay = "—";
			if (fileObj.timestamp && fileObj.timestamp > 0) {
				const date = new Date(fileObj.timestamp * 1000);
				dateDisplay = date.toLocaleString('de-DE', {
					year: 'numeric',
					month: '2-digit',
					day: '2-digit',
					hour: '2-digit',
					minute: '2-digit'
				});
			}

			// Find mapping for this file
			const mapping = mappings.find(m => m.song === fileObj.name);
			const tagId = mapping ? mapping.tagid : null;

			// NFC Tag cell with actions
			let nfcTagCell = '';
			if (tagId) {
				nfcTagCell = `
					<div class="flex items-center gap-2">
						<span class="inline-flex items-center gap-2 px-3 py-1.5 bg-blue-500/20 text-blue-400 rounded-lg text-xs font-mono border border-blue-500/30">
							${tagId}
						</span>
						<button class="remove-mapping-btn p-1.5 hover:bg-red-500/20 text-red-400 hover:text-red-300 rounded transition-colors" title="Remove NFC Mapping">✕</button>
					</div>
				`;
			} else {
				nfcTagCell = `
					<div class="flex items-center gap-2">
						<span class="text-slate-500 text-sm italic">not mapped</span>
						<button class="assign-tag-btn p-1.5 hover:bg-blue-500/20 text-blue-400 hover:text-blue-300 rounded transition-colors" title="Assign NFC Tag">🏷</button>
					</div>
				`;
			}

			const row = `
				<tr data-filename="${fileObj.name}" data-tagid="${tagId || ''}" data-timestamp="${fileObj.timestamp || 0}" data-size="${fileObj.size}" class="hover:bg-slate-700/50 transition-colors duration-150">
					<td class="px-4 py-3 text-center">
						<button class="play-btn w-10 h-10 rounded-full bg-blue-500 hover:bg-blue-600 text-white transition-all duration-200 flex items-center justify-center mx-auto shadow-lg hover:shadow-xl" title="Play preview">▶</button>
					</td>
					<td class="px-4 py-3 font-medium text-slate-100">
						${fileObj.name}
					</td>
					<td class="px-4 py-3 text-slate-400 text-sm hidden md:table-cell">
						${sizeDisplay}
					</td>
					<td class="px-4 py-3 text-slate-400 text-sm hidden lg:table-cell">
						${dateDisplay}
					</td>
					<td class="px-4 py-3">
						${nfcTagCell}
					</td>
					<td class="px-4 py-3">
						<div class="flex gap-1 justify-center">
							<button class="download-btn p-2 hover:bg-slate-600 rounded transition-colors text-slate-300 hover:text-slate-100" title="Download">⬇</button>
							<button class="rename-btn p-2 hover:bg-slate-600 rounded transition-colors text-slate-300 hover:text-slate-100" title="Rename">✎</button>
							<button class="delete-btn p-2 hover:bg-red-500/20 text-red-400 hover:text-red-300 rounded transition-colors" title="Delete">🗑</button>
						</div>
					</td>
				</tr>
			`;

			$("#files-tbody").append(row);
		});

		// Apply current sort after loading
		sortTable(currentSort.column);
	}).catch(function(error) {
		console.error("Error loading file list:", error);
		showToast("Error loading file list. Check console for details.", "error");
	});
}

// ==================== FILE UPLOAD ====================

// Show selected files
$("#file-input").on("change", function() {
	const files = this.files;
	if (files.length > 0) {
		$("#selected-files").removeClass("hidden");
		$("#selected-files-list").empty();
		for (let i = 0; i < files.length; i++) {
			const sizeKB = (files[i].size / 1024).toFixed(1);
			$("#selected-files-list").append(`<div>📄 ${files[i].name} (${sizeKB} KB)</div>`);
		}
	} else {
		$("#selected-files").addClass("hidden");
	}
});

function uploadFileSequentially(files, index) {
	if (index >= files.length) {
		showToast("All files uploaded successfully!", "success");

		// Reset UI
		document.getElementById('file-input').value = "";
		$("#selected-files").addClass("hidden");
		$("#upload-progress-container").addClass("hidden");
		$("#upload-progress-bar").css("width", "0%");

		// Refresh file list and dropdown
		refreshFileList();
		$('#songs-select').empty();
		$('#songs-select').append(new Option("Select a song...", ""));
		$.getJSON("/songs", function(data) {
			$.each(data, function(key, fileObj) {
				$('#songs-select').append(new Option(fileObj.name, fileObj.name));
			});
		});
		return;
	}

	const file = files[index];
	const formData = new FormData();
	formData.append('data', file);

	console.log(`Uploading file ${index + 1}/${files.length}: ${file.name}`);

	// Show progress bar
	$("#upload-progress-container").removeClass("hidden");
	$("#upload-progress").html(`Uploading ${file.name} (${index+1}/${files.length})...`);
	$("#upload-progress-bar").css("width", "0%");

	$.ajax({
		url: '/upload',
		type: 'POST',
		data: formData,
		processData: false,
		contentType: false,
		xhr: function() {
			const xhr = new window.XMLHttpRequest();
			xhr.upload.addEventListener("progress", function(evt) {
				if (evt.lengthComputable) {
					const percentComplete = (evt.loaded / evt.total) * 100;
					$("#upload-progress-bar").css("width", percentComplete + "%");
					$("#upload-progress").html(
						`Uploading ${file.name}: ${percentComplete.toFixed(1)}%`
					);
					console.log(`Upload progress: ${percentComplete.toFixed(1)}%`);
				}
			}, false);
			return xhr;
		},
		success: function(response) {
			console.log("Upload response:", response);
			if (response.result === "OK") {
				showToast(`${file.name} uploaded successfully`, "success");
				uploadFileSequentially(files, index + 1);
			} else {
				console.error("Upload failed:", response);
				showToast(`Upload failed for ${file.name}: ${response.message || 'Unknown error'}`, "error");
				$("#upload-progress-container").addClass("hidden");
			}
		},
		error: function(xhr, status, error) {
			console.error("Upload error:", status, error, xhr.responseText);
			showToast(`Upload error for ${file.name}: ${error}`, "error");
			$("#upload-progress-container").addClass("hidden");

			// Reset UI on error
			document.getElementById('file-input').value = "";
			$("#selected-files").addClass("hidden");
		}
	});
}

$("#upload-button").on("click", function() {
	const files = document.getElementById('file-input').files;

	if (files.length === 0) {
		showToast("Please select files to upload", "warning");
		return;
	}

	// Validate all files are MP3
	for (let i = 0; i < files.length; i++) {
		if (!files[i].name.toLowerCase().endsWith('.mp3')) {
			showToast(`Invalid file: ${files[i].name}. Only MP3 files allowed.`, "error");
			return;
		}
	}

	uploadFileSequentially(files, 0);
});

// ==================== FILE ACTIONS ====================

$(document).on("click", ".download-btn", function() {
	const filename = $(this).closest('tr').data('filename');
	window.location.href = `/download?file=${encodeURIComponent(filename)}`;
});

$(document).on("click", ".delete-btn", function() {
	const filename = $(this).closest('tr').data('filename');

	if (!confirm(`Delete ${filename}? This cannot be undone.`)) {
		return;
	}

	$.ajax({
		type: 'POST',
		url: '/deletefile',
		data: JSON.stringify({filename: filename}),
		contentType: "application/json",
		dataType: 'json',
		success: function(response) {
			if (response.result === "OK") {
				showToast("File deleted successfully", "success");
				refreshFileList();
				// Refresh songs dropdown
				$('#songs-select').empty();
				$('#songs-select').append(new Option("Select a song...", ""));
				$.getJSON("/songs", function(data) {
					$.each(data, function(key, fileObj) {
						$('#songs-select').append(new Option(fileObj.name, fileObj.name));
					});
				});
			} else if (response.result === "INUSE") {
				showToast("Cannot delete: File is mapped to NFC tag(s). Remove mappings first.", "error");
			} else {
				showToast(`Delete failed: ${response.message}`, "error");
			}
		},
		error: function() {
			showToast("Error deleting file", "error");
		}
	});
});

$(document).on("click", ".rename-btn", function() {
	const oldFilename = $(this).closest('tr').data('filename');
	const newFilename = prompt(`Rename "${oldFilename}" to:`, oldFilename);

	if (!newFilename || newFilename === oldFilename) {
		return;
	}

	if (!newFilename.toLowerCase().endsWith('.mp3')) {
		showToast("Filename must end with .mp3", "error");
		return;
	}

	$.ajax({
		type: 'POST',
		url: '/renamefile',
		data: JSON.stringify({
			oldname: oldFilename,
			newname: newFilename
		}),
		contentType: "application/json",
		dataType: 'json',
		success: function(response) {
			if (response.result === "OK") {
				showToast("File renamed successfully", "success");

				if (response.mappingsUpdated) {
					showToast("NFC mappings updated with new filename", "info");
				}

				refreshFileList();
				// Refresh songs dropdown
				$('#songs-select').empty();
				$('#songs-select').append(new Option("Select a song...", ""));
				$.getJSON("/songs", function(data) {
					$.each(data, function(key, fileObj) {
						$('#songs-select').append(new Option(fileObj.name, fileObj.name));
					});
				});
			} else if (response.result === "EXISTS") {
				showToast("A file with that name already exists", "error");
			} else {
				showToast(`Rename failed: ${response.message}`, "error");
			}
		},
		error: function() {
			showToast("Error renaming file", "error");
		}
	});
});

// ==================== AUDIO PREVIEW ====================

$(document).on("click", ".play-btn", function() {
	const filename = $(this).closest('tr').data('filename');
	const button = $(this);

	// If this button is currently playing, pause it
	if (currentAudio && button.html() === "⏸") {
		currentAudio.pause();
		currentAudio = null;
		button.html("▶");
		return;
	}

	// Stop current audio if playing
	if (currentAudio && !currentAudio.paused) {
		currentAudio.pause();
		currentAudio = null;
		$(".play-btn").html("▶");
	}

	// Create and play new audio
	const audio = new Audio(`/download?file=${encodeURIComponent(filename)}`);
	audio.play();
	currentAudio = audio;

	button.html("⏸");

	// Reset button when playback ends
	audio.addEventListener('ended', function() {
		button.html("▶");
		currentAudio = null;
	});

	// Handle pause
	audio.addEventListener('pause', function() {
		if (!audio.ended) {
			button.html("▶");
		}
	});
});

// ==================== ASSIGN/REMOVE NFC TAG ====================

let modalCurrentFilename = null;

$(document).on("click", ".assign-tag-btn", function() {
	modalCurrentFilename = $(this).closest('tr').data('filename');

	const tagId = prompt(`Assign NFC Tag to: ${modalCurrentFilename}\n\nScan tag and click "Scan Tag" button first, or enter Tag ID manually:`);

	if (!tagId) return;

	// Check if tag already mapped
	$.getJSON("/mappings", function(mappings) {
		const existing = mappings.find(m => m.tagid === tagId);

		if (existing) {
			if (!confirm(`Tag ${tagId} is already mapped to "${existing.song}". Overwrite?`)) {
				return;
			}
			// Delete old mapping first
			$.ajax({
				type: 'POST',
				url: '/delmapping',
				data: JSON.stringify({tagid: tagId}),
				contentType: "application/json",
				dataType: 'json',
				success: function() {
					// Now add new mapping
					addMapping(tagId, modalCurrentFilename);
				}
			});
		} else {
			addMapping(tagId, modalCurrentFilename);
		}
	});
});

function addMapping(tagId, filename) {
	$.ajax({
		type: 'POST',
		url: '/addmapping',
		data: JSON.stringify({tagid: tagId, song: filename}),
		contentType: "application/json",
		dataType: 'json',
		success: function(response) {
			if (response.result === "OK") {
				showToast("Tag assigned successfully", "success");
				refreshFileList();
			} else {
				showToast(`Failed to assign tag: ${response.message}`, "error");
			}
		},
		error: function() {
			showToast("Error assigning tag", "error");
		}
	});
}

$(document).on("click", ".remove-mapping-btn", function() {
	const filename = $(this).closest('tr').data('filename');
	const tagId = $(this).closest('tr').data('tagid');

	if (!confirm(`Remove NFC tag mapping for "${filename}"?`)) {
		return;
	}

	$.ajax({
		type: 'POST',
		url: '/delmapping',
		data: JSON.stringify({tagid: tagId}),
		contentType: "application/json",
		dataType: 'json',
		success: function(response) {
			if (response.result === "OK") {
				showToast("Mapping removed successfully", "success");
				refreshFileList();
			} else {
				showToast(`Failed to remove mapping: ${response.message}`, "error");
			}
		},
		error: function() {
			showToast("Error removing mapping", "error");
		}
	});
});

// ==================== SORTING ====================

function sortTable(column) {
	const tbody = $("#files-tbody");
	const rows = tbody.find("tr").toArray();

	// Toggle ascending/descending
	if (currentSort.column === column) {
		currentSort.ascending = !currentSort.ascending;
	} else {
		currentSort.column = column;
		currentSort.ascending = true;
	}

	rows.sort((a, b) => {
		let valA, valB;

		if (column === 'name') {
			valA = $(a).data('filename').toLowerCase();
			valB = $(b).data('filename').toLowerCase();
			return currentSort.ascending
				? valA.localeCompare(valB)
				: valB.localeCompare(valA);
		}
		else if (column === 'size') {
			valA = parseInt($(a).data('size')) || 0;
			valB = parseInt($(b).data('size')) || 0;
			return currentSort.ascending
				? valA - valB
				: valB - valA;
		}
		else if (column === 'date') {
			valA = parseInt($(a).data('timestamp')) || 0;
			valB = parseInt($(b).data('timestamp')) || 0;
			return currentSort.ascending
				? valA - valB
				: valB - valA;
		}
	});

	// Re-append rows in sorted order
	tbody.empty();
	rows.forEach(row => tbody.append(row));

	// Update column headers to show sort direction
	$(".sortable").removeClass("text-blue-400");
	$(`.sortable[data-sort="${column}"]`).addClass("text-blue-400");
}

// Event handler for sortable column headers
$(document).on("click", ".sortable", function() {
	const column = $(this).data('sort');
	sortTable(column);
});

// END
});
